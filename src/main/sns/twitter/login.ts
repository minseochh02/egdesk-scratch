import "dotenv/config";

import { chromium, devices, Page, Browser, BrowserContext } from "playwright";

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

async function createContext(storageState?: string): Promise<{
  browser: Browser;
  context: BrowserContext;
  page: Page;
}> {
  const browser = await chromium.launch({
    timeout: 60000,
    headless: false,
    slowMo: 1000,
    channel: "chrome",
    ignoreDefaultArgs: ["--enable-automation"],
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
  });
  const context = await browser.newContext({
    ...devices["Desktop Chrome"],
    ...(storageState ? { storageState } : {}),
  });
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

export async function getAuthenticatedPage(): Promise<AuthContext> {
  const { browser, context, page } = await createContext(authFile);

  const close: CloseFn = async () => {
    await page.close();
    await context.close();
    await browser.close();
  };

  return { page, close };
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

