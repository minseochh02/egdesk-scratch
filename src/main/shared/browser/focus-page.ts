import type { Page } from 'playwright-core';

/**
 * Activate the Playwright-controlled tab and move focus from the address bar into the page.
 * Helps before Arduino HID input or when a headful browser opens with omnibox focus.
 */
export async function focusPlaywrightPage(
  page: Page | null | undefined,
  log?: (message: string, ...rest: unknown[]) => void,
): Promise<void> {
  if (!page || (typeof page.isClosed === 'function' && page.isClosed())) return;
  try {
    if (typeof page.bringToFront === 'function') {
      await page.bringToFront();
    }
    await page.click('body', { timeout: 3000 }).catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (log) log('focusPlaywrightPage failed:', msg);
  }
}
