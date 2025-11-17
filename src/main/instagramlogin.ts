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

const DEFAULT_LAUNCH_ARGS = ["--disable-gpu"];
const DEFAULT_HEADLESS = true;
const PLAYWRIGHT_CHROME_CHANNEL = process.env.PLAYWRIGHT_CHROME_CHANNEL || "chrome";
const CHROME_EXECUTABLE_PATH =
  typeof process.env.CHROME_EXECUTABLE_PATH === "string" && process.env.CHROME_EXECUTABLE_PATH.trim().length > 0
    ? process.env.CHROME_EXECUTABLE_PATH.trim()
    : undefined;
const LOGIN_SETTLE_DELAY_MS = 1000;
const INSTAGRAM_HOME_URL = "https://www.instagram.com/";

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
  await page.goto(INSTAGRAM_HOME_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await dismissCookieBanner(page);

  const idInput = page.locator("[name=username]");
  const pwInput = page.locator("[type=password]");
  const loginButton = page.locator("[type=submit]");

  await idInput.waitFor({ state: "visible", timeout: 45_000 });
  await pwInput.waitFor({ state: "visible", timeout: 45_000 });
  await loginButton.waitFor({ state: "visible", timeout: 45_000 });

  await idInput.fill(credentials.username);
  await pwInput.fill(credentials.password);

  await page.waitForTimeout(LOGIN_SETTLE_DELAY_MS);
  await loginButton.click();

  await page.waitForURL((url) => url.href.startsWith(INSTAGRAM_HOME_URL), {
    timeout: 60_000,
  });
  await dismissLoginInfoPrompt(page);
  await page
    .locator("[aria-label='New post']")
    .first()
    .waitFor({ state: "visible", timeout: 60_000 });
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
  const context = await browser.newContext();
  const page = await context.newPage();

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

