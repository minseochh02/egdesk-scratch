import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { app } from "electron";

import { chromium, Browser, BrowserContext, Page, LaunchOptions } from "playwright";

// Optimize Playwright for bundled Electron apps
// In bundled apps, Playwright can be slow due to:
// 1. ASAR archive access when loading browser binaries
// 2. Browser binary discovery taking longer
// 3. Dynamic require() calls being slower
// Solution: Set environment variables to help Playwright find browsers faster
if (app && app.isPackaged) {
  // In production/bundled app, try to use system Chrome if available
  // This avoids Playwright needing to download/manage its own browsers
  const possibleChromePaths = [
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  
  // Check if system Chrome exists and set as default
  for (const chromePath of possibleChromePaths) {
    try {
      if (fs.existsSync(chromePath)) {
        process.env.CHROME_EXECUTABLE_PATH = chromePath;
        console.log('[youtubelogin] Using system Chrome for better performance:', chromePath);
        break;
      }
    } catch (e) {
      // Continue checking
    }
  }
  
  // Set Playwright to use faster browser discovery
  // This reduces the time Playwright spends looking for browsers
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    // Use a local cache directory that's not in ASAR
    const cacheDir = app.getPath('userData');
    const playwrightCache = path.join(cacheDir, '.playwright');
    process.env.PLAYWRIGHT_BROWSERS_PATH = playwrightCache;
    console.log('[youtubelogin] Set Playwright browsers cache path:', playwrightCache);
  }
}

import { createYouTubePost, YouTubePostOptions, YouTubeContentPlan } from "./youtube-post";

type CloseFn = () => Promise<void>;

export interface AuthContext {
  page: Page;
  close: CloseFn;
}

export interface LoginOptions {
  username?: string;
  password?: string;
  /** Chrome user data directory path - if provided, uses existing logged-in session (recommended) */
  chromeUserDataDir?: string;
  /** Chrome executable path - required if using chromeUserDataDir */
  chromeExecutablePath?: string;
}

interface Credentials {
  username: string;
  password: string;
}

interface VideoUploadInput {
  videoPath?: string;
  title?: string;
  description?: string;
  tags?: string[];
  structuredPrompt?: YouTubeContentPlan;
  visibility?: 'public' | 'unlisted' | 'private';
  waitAfterPublish?: number;
}

interface RunOptions {
  credentials?: LoginOptions;
  videoUpload?: VideoUploadInput;
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
  "--disable-extensions-except", // Allow extensions (makes it look more like real Chrome)
  "--disable-default-apps",
  "--exclude-switches=enable-automation", // Remove automation flag
  "--disable-sync", // Disable sync to avoid detection
];

// Default to NON-headless for YouTube to avoid detection
// Set YOUTUBE_HEADLESS=true to run headless (not recommended for YouTube)
const DEFAULT_HEADLESS = process.env.YOUTUBE_HEADLESS === 'true' ? true : false;
const PLAYWRIGHT_CHROME_CHANNEL = process.env.PLAYWRIGHT_CHROME_CHANNEL || "chrome";
const CHROME_EXECUTABLE_PATH =
  typeof process.env.CHROME_EXECUTABLE_PATH === "string" && process.env.CHROME_EXECUTABLE_PATH.trim().length > 0
    ? process.env.CHROME_EXECUTABLE_PATH.trim()
    : undefined;
const LOGIN_SETTLE_DELAY_MS = 2000;
const YOUTUBE_STUDIO_URL = "https://studio.youtube.com/";
const YOUTUBE_LOGIN_URL = "https://accounts.google.com/signin/v2/identifier?service=youtube&continue=https%3A%2F%2Fwww.youtube.com%2Fsignin%3Faction_handle_signin%3Dtrue%26app%3Ddesktop%26next%3Dhttps%3A%2F%2Fwww.youtube.com%2F&flowName=GlifWebSignIn&flowEntry=ServiceLogin";

function resolveCredentials(options: LoginOptions = {}): Credentials {
  const username = options.username ?? process.env.YOUTUBE_USERNAME;
  const password = options.password ?? process.env.YOUTUBE_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "YouTube credentials are required. Provide username/password or set YOUTUBE_USERNAME and YOUTUBE_PASSWORD."
    );
  }

  return { username, password };
}

async function performYouTubeLogin(page: Page, credentials: Credentials): Promise<void> {
  console.log('[performYouTubeLogin] Starting YouTube login...');
  
  try {
    // Navigate to YouTube login page
    await page.goto(YOUTUBE_LOGIN_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await page.waitForTimeout(2000);

    // Fill in email/username
    console.log('[performYouTubeLogin] Filling in email...');
    const emailInputSelectors = [
      'input[type="email"]',
      'input[name="identifier"]',
      '#identifierId',
      'input[aria-label*="Email"]',
      'input[aria-label*="email"]',
    ];

    let emailInput = null;
    for (const selector of emailInputSelectors) {
      try {
        const input = page.locator(selector).first();
        if (await input.count() > 0) {
          emailInput = input;
          break;
        }
      } catch (e) {
        // Continue
      }
    }

    if (!emailInput) {
      throw new Error('Could not find email input field on YouTube login page');
    }

    await emailInput.fill(credentials.username);
    await page.waitForTimeout(1000);

    // Click Next button
    const nextButton = page.locator('button:has-text("Next"), button:has-text("NEXT"), button[type="submit"]').first();
    if (await nextButton.count() > 0) {
      await nextButton.click();
      await page.waitForTimeout(2000);
    }

    // Fill in password
    console.log('[performYouTubeLogin] Filling in password...');
    const passwordInputSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      'input[aria-label*="Password"]',
      'input[aria-label*="password"]',
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
      throw new Error('Could not find password input field on YouTube login page');
    }

    await passwordInput.fill(credentials.password);
    await page.waitForTimeout(1000);

    // Click Next/Submit button
    const submitButton = page.locator('button:has-text("Next"), button:has-text("NEXT"), button[type="submit"]').first();
    if (await submitButton.count() > 0) {
      await submitButton.click();
    }

    // Wait for login to complete
    console.log('[performYouTubeLogin] Waiting for login to complete...');
    await page.waitForTimeout(5000);

    // Handle any dialogs or "Continue" buttons that may appear after login
    console.log('[performYouTubeLogin] Checking for Continue/Next buttons or dialogs...');
    try {
      // Look for "Continue" button in multiple languages (Korean: 계속, English: Continue, etc.)
      const continueButtonSelectors = [
        'button:has-text("계속")', // Korean: Continue
        'button:has-text("Continue")',
        'button:has-text("CONTINUE")',
        'button:has-text("다음")', // Korean: Next
        'button:has-text("Next")',
        'button:has-text("NEXT")',
        'button[aria-label*="Continue"]',
        'button[aria-label*="계속"]',
        'yt-button-shape:has-text("계속")',
        'yt-button-shape:has-text("Continue")',
      ];

      for (const selector of continueButtonSelectors) {
        try {
          const button = page.locator(selector).first();
          if (await button.count() > 0) {
            const isVisible = await button.isVisible({ timeout: 2000 }).catch(() => false);
            if (isVisible) {
              console.log(`[performYouTubeLogin] Found Continue button with selector: ${selector}, clicking...`);
              await button.click();
              await page.waitForTimeout(2000);
              break;
            }
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      // Also check for any modal/dialog close buttons
      const closeButtonSelectors = [
        'button[aria-label*="Close"]',
        'button[aria-label*="닫기"]', // Korean: Close
        'button:has-text("닫기")',
        '[aria-label="Close"]',
      ];

      for (const selector of closeButtonSelectors) {
        try {
          const button = page.locator(selector).first();
          if (await button.count() > 0 && await button.isVisible({ timeout: 1000 }).catch(() => false)) {
            console.log(`[performYouTubeLogin] Found close button, clicking...`);
            await button.click();
            await page.waitForTimeout(1000);
            break;
          }
        } catch (e) {
          // Continue
        }
      }
    } catch (error) {
      console.warn('[performYouTubeLogin] Error handling dialogs/continue buttons:', error);
    }

    // Check if we're logged in by navigating to YouTube Studio
    try {
      await page.goto(YOUTUBE_STUDIO_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForTimeout(3000);

      // Check if we see YouTube Studio elements (indicating successful login)
      const studioElements = await page.locator('button[aria-label="Create"], #create-icon').count();
      if (studioElements > 0) {
        console.log('[performYouTubeLogin] Login successful - YouTube Studio loaded');
      } else {
        console.warn('[performYouTubeLogin] YouTube Studio loaded but Create button not found - login may have failed');
      }
    } catch (error) {
      console.error('[performYouTubeLogin] Failed to navigate to YouTube Studio after login:', error);
      throw new Error('Login may have failed - could not access YouTube Studio');
    }

    // Take screenshot for debugging
    try {
      const tempDir = app?.getPath?.('temp') || os.tmpdir();
      const screenshotDir = path.join(tempDir, 'egdesk-youtube-screenshots');
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }
      const screenshotPath = path.join(screenshotDir, `youtube_login_${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`[performYouTubeLogin] Login screenshot saved to: ${screenshotPath}`);
    } catch (e) {
      console.warn('[performYouTubeLogin] Could not take screenshot:', e);
    }

  } catch (error) {
    console.error('[performYouTubeLogin] Login error:', error);
    throw error;
  }
}

/**
 * Get an authenticated YouTube page
 * 
 * Recommended approach: Use chromeUserDataDir to reuse existing logged-in Chrome session
 * This avoids CAPTCHA and 2FA issues. User logs in manually once, then script reuses that session.
 * 
 * Alternative: Provide username/password to automate login (may hit CAPTCHA/2FA)
 */
export async function getAuthenticatedPage(
  loginOptions?: LoginOptions
): Promise<AuthContext> {
  // Strategy 1: Use Chrome user data directory (recommended - like the GitHub repo approach)
  if (loginOptions?.chromeUserDataDir) {
    console.log('[getAuthenticatedPage] Using Chrome user data directory (persistent session)...');
    console.log('[getAuthenticatedPage] User data dir:', loginOptions.chromeUserDataDir);
    
    if (!loginOptions.chromeExecutablePath) {
      throw new Error('chromeExecutablePath is required when using chromeUserDataDir');
    }

    try {
      // Use launchPersistentContext to reuse existing Chrome profile
      // This is Playwright's equivalent of Selenium's user-data-dir approach
            const context = await chromium.launchPersistentContext(loginOptions.chromeUserDataDir, {
              headless: DEFAULT_HEADLESS,
              executablePath: loginOptions.chromeExecutablePath,
              args: [
                ...DEFAULT_LAUNCH_ARGS,
                // Performance optimizations for bundled apps
                '--disable-background-networking',
                '--disable-background-timer-throttling',
                '--disable-renderer-backgrounding',
                '--disable-backgrounding-occluded-windows',
                '--disable-breakpad',
                '--disable-component-extensions-with-background-pages',
                '--disable-extensions',
                '--disable-features=TranslateUI',
                '--disable-ipc-flooding-protection',
                '--disable-hang-monitor',
                '--disable-prompt-on-repost',
                '--disable-sync',
                '--disable-domain-reliability',
                '--disable-client-side-phishing-detection',
                '--disable-component-update',
                '--no-default-browser-check',
                '--no-first-run',
                '--no-pings',
                '--no-zygote',
                '--use-mock-keychain',
              ],
              viewport: { width: 1920, height: 1080 },
              userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              locale: 'en-US',
              timezoneId: 'America/New_York',
              timeout: 30000, // Reduced timeout for faster failure detection
            });

      const page = context.pages()[0] || await context.newPage();
      
      // Add comprehensive anti-detection script
      await page.addInitScript(() => {
        // Remove webdriver flag
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
        
        // Mock chrome object
        (window as any).chrome = {
          runtime: {},
          loadTimes: function() {},
          csi: function() {},
          app: {},
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
          get: () => 'Win32',
        });
        
        // Mock hardware concurrency
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: () => 8,
        });
        
        // Mock device memory
        Object.defineProperty(navigator, 'deviceMemory', {
          get: () => 8,
        });
        
        // Override toString methods to hide automation
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter: number) {
          if (parameter === 37445) {
            return 'Intel Inc.';
          }
          if (parameter === 37446) {
            return 'Intel Iris OpenGL Engine';
          }
          return getParameter.call(this, parameter);
        };
      });

      // Navigate to YouTube Studio to verify we're logged in
      console.log('[getAuthenticatedPage] Verifying YouTube login...');
      try {
        await page.goto(YOUTUBE_STUDIO_URL, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForTimeout(3000);
        
        // Check if we're logged in by looking for YouTube Studio elements
        const studioText = await page.locator('text=Studio').first().count().catch(() => 0);
        const uploadText = await page.locator('text=Upload').first().count().catch(() => 0);
        const createButton = await page.locator('[aria-label*="Create"]').first().count().catch(() => 0);
        const isLoggedIn = studioText > 0 || uploadText > 0 || createButton > 0;
        
        if (!isLoggedIn) {
          console.warn('[getAuthenticatedPage] May not be logged in. Please log in manually in Chrome first, then use this profile.');
        } else {
          console.log('[getAuthenticatedPage] ✅ Successfully using existing logged-in session');
        }
      } catch (error) {
        console.warn('[getAuthenticatedPage] Failed to verify login, but continuing:', error);
      }

      const close: CloseFn = async () => {
        try {
          await context.close();
        } catch (error) {
          console.error('[getAuthenticatedPage] Error closing persistent context:', error);
        }
      };

      return { page, close };
    } catch (error) {
      console.error('[getAuthenticatedPage] Failed to launch persistent context:', error);
      throw new Error(`Failed to use Chrome user data directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Strategy 2: Regular browser launch with optional login automation
  console.log('[getAuthenticatedPage] Launching browser with new context...');
  
  // Optimize for bundled/production environment
  // In bundled apps, Playwright can be slow due to ASAR archive access
  // Use faster launch options and reduce overhead
  const launchOptions: LaunchOptions = {
    headless: DEFAULT_HEADLESS,
    channel: PLAYWRIGHT_CHROME_CHANNEL,
    args: [
      ...DEFAULT_LAUNCH_ARGS,
      // Performance optimizations for bundled apps
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-component-extensions-with-background-pages',
      '--disable-extensions',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--disable-hang-monitor',
      '--disable-prompt-on-repost',
      '--disable-sync',
      '--disable-domain-reliability',
      '--disable-client-side-phishing-detection',
      '--disable-component-update',
      '--no-default-browser-check',
      '--no-first-run',
      '--no-pings',
      '--no-zygote',
      '--use-mock-keychain', // macOS only, but harmless on other platforms
    ],
    executablePath: CHROME_EXECUTABLE_PATH,
    // Reduce timeout for faster failure detection
    timeout: 30000, // 30 seconds instead of default 60
  };

  console.log('[getAuthenticatedPage] Launch options:', {
    headless: launchOptions.headless,
    channel: launchOptions.channel,
    timeout: launchOptions.timeout,
  });

  const browser: Browser = await chromium.launch(launchOptions);
  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    // Add extra HTTP headers to look more like a real browser
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    },
  });

  const page: Page = await context.newPage();
  
  // Add comprehensive anti-detection script
  await page.addInitScript(() => {
    // Remove webdriver flag
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    
    // Mock chrome object
    (window as any).chrome = {
      runtime: {},
      loadTimes: function() {},
      csi: function() {},
      app: {},
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
      get: () => 'Win32',
    });
    
    // Mock hardware concurrency
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => 8,
    });
    
    // Mock device memory
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => 8,
    });
    
    // Override toString methods to hide automation
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter: number) {
      if (parameter === 37445) {
        return 'Intel Inc.';
      }
      if (parameter === 37446) {
        return 'Intel Iris OpenGL Engine';
      }
      return getParameter.call(this, parameter);
    };
  });

  // Perform login if credentials provided
  if (loginOptions?.username && loginOptions?.password) {
    console.log('[getAuthenticatedPage] Attempting automated login (may encounter CAPTCHA/2FA)...');
    try {
      await performYouTubeLogin(page, resolveCredentials(loginOptions));
    } catch (loginError) {
      await browser.close();
      throw new Error(`YouTube login failed: ${loginError instanceof Error ? loginError.message : 'Unknown error'}. Consider using chromeUserDataDir instead to avoid CAPTCHA/2FA issues.`);
    }
  } else {
    // Navigate to YouTube Studio (assumes already logged in)
    console.log('[getAuthenticatedPage] No credentials provided, assuming already logged in');
    try {
      await page.goto(YOUTUBE_STUDIO_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForTimeout(2000);
    } catch (error) {
      console.warn('[getAuthenticatedPage] Failed to navigate to YouTube Studio:', error);
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
 * Main function to run YouTube automation
 * Can be used for testing or as a standalone script
 */
export async function runYouTubeAutomation(options: RunOptions = {}): Promise<void> {
  console.log('[runYouTubeAutomation] Starting YouTube automation...');

  const authContext = await getAuthenticatedPage(options.credentials);

  try {
    if (options.videoUpload) {
      const { videoPath, title, description, tags, structuredPrompt, visibility, waitAfterPublish } = options.videoUpload;

      if (!videoPath) {
        throw new Error('Video path is required for video upload');
      }

      const postOptions: YouTubePostOptions = {
        videoPath,
        title,
        description,
        tags,
        structuredPrompt,
        visibility,
        waitAfterPublish,
      };

      await createYouTubePost(authContext.page, postOptions);
      console.log('[runYouTubeAutomation] Video upload completed');
    }
  } finally {
    await authContext.close();
  }
}

// If run as a script directly
if (require.main === module) {
  const videoPath = process.argv[2];
  const title = process.argv[3];
  const description = process.argv[4];

  if (!videoPath) {
    console.error('Usage: node youtubelogin.js <videoPath> [title] [description]');
    process.exit(1);
  }

  runYouTubeAutomation({
    credentials: {
      username: process.env.YOUTUBE_USERNAME,
      password: process.env.YOUTUBE_PASSWORD,
    },
    videoUpload: {
      videoPath,
      title,
      description,
    },
  }).catch((error) => {
    console.error('YouTube automation failed:', error);
    process.exit(1);
  });
}

