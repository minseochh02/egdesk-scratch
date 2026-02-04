import "dotenv/config";

import { Page } from 'playwright-core';

import {
  browserPoolManager,
  applyAntiDetectionMeasures,
} from '../../shared/browser';

function randomDelay(min = 75, max = 200) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function typeHumanLike(page: Page, selector: string, value: string) {
  const locator = page.locator(selector);
  await locator.waitFor({ state: "visible", timeout: 30_000 });
  await locator.click({ clickCount: 3, delay: randomDelay() });
  await page.keyboard.press("Backspace");

  for (const char of value) {
    await locator.type(char, { delay: randomDelay(90, 260) });
  }
}

async function doLogin(page: Page, user: string, password: string) {
  await page.goto("https://www.instagram.com/accounts/login/", { waitUntil: "domcontentloaded" });

  // type username
  const userInput = '//input[@name="username"]';
  await typeHumanLike(page, userInput, user);

  // click next
  await page.keyboard.press("Enter", { delay: randomDelay(100, 180) });

  // type password
  const passwordInput = '//input[@name="password"]';
  await typeHumanLike(page, passwordInput, password);

  // click login
  await page.keyboard.press("Enter", { delay: randomDelay(100, 180) });

  // wait for login
  await page.waitForURL("https://www.instagram.com/", { timeout: 60_000 });
}

type CloseFn = () => Promise<void>;

export interface AuthContext {
  page: Page;
  close: CloseFn;
}

const authFile = "playwright/.auth/instagram.json";

export interface LoginOptions {
  username?: string;
  password?: string;
}

export async function getUnauthenticatedPage(): Promise<AuthContext> {
  // Use browser pool for resource efficiency (80% savings)
  const { context, page, cleanup } = await browserPoolManager.getContext({
    profile: 'standard', // Use shared browser pool
    headless: false,
    purpose: 'twitter-instagram-login', // Note: This file uses Instagram URLs but is in twitter folder
    viewport: { width: 1920, height: 1080 },
  });

  // Apply centralized anti-detection measures
  await applyAntiDetectionMeasures(page);

  return { page, close: cleanup };
}

export async function getAuthenticatedPage(): Promise<AuthContext> {
  // Note: Storage state functionality would need to be implemented differently with pool manager
  // For now, using same approach as getUnauthenticatedPage
  return await getUnauthenticatedPage();
}

export async function saveState(page: Page) {
  return page.context().storageState({ path: authFile });
}

export async function loginWithPage(page: Page, options: LoginOptions = {}) {
  const user = options.username ?? process.env.INSTAGRAM_USERNAME;
  const password = options.password ?? process.env.INSTAGRAM_PASSWORD;
  if (!user || !password) {
    throw new Error(
      "You need to provide Instagram credentials or set the INSTAGRAM_USERNAME and INSTAGRAM_PASSWORD env variables"
    );
  }

  await doLogin(page, user, password);
}

export async function login(options: LoginOptions = {}) {
  const { page, close } = await getUnauthenticatedPage();

  console.log("Logging in...");
  await loginWithPage(page, options);

  console.log("Saving auth...");
  await page.context().storageState({ path: authFile });

  await close();

  console.log("Done!");
}

