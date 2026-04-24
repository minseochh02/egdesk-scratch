/**
 * Shared locator strategy ordering and Playwright execution for browser recorder
 * replay (in-app) — matches generateTestCode() semantics.
 */
import type { FrameLocator, Locator, Page } from 'playwright-core';

export type LocatorStrategyKind = 'semantic' | 'css' | 'xpath';

export interface RecordedActionLocatorFields {
  selector?: string;
  xpath?: string;
  role?: string;
  ariaLabel?: string;
  innerText?: string;
  frameSelector?: string;
  preferredLocatorStrategy?: LocatorStrategyKind;
  inputType?: string;
}

function normalizeSelectorForPlaywright(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  if (/^[a-zA-Z][a-zA-Z0-9_-]*=/.test(s)) return s;
  if (s.startsWith('/')) return `xpath=${s}`;
  return s;
}

/** Same ordering rules as generateTestCode() for clicks */
export function getClickStrategyOrder(action: RecordedActionLocatorFields): LocatorStrategyKind[] {
  const hasRole = !!(action.role && (action.ariaLabel || action.innerText));
  const hasText =
    !!action.innerText && action.innerText.length > 0 && action.innerText.length < 50;
  const hasXPath = !!action.xpath;

  const semanticFirst =
    !!(action.role && action.ariaLabel) ||
    !!(action.role && hasText) ||
    hasText;

  const list: LocatorStrategyKind[] = [];
  if (semanticFirst) {
    list.push('semantic');
    list.push('css');
    if (hasXPath) list.push('xpath');
  } else {
    list.push('css');
    if (hasXPath) list.push('xpath');
  }

  return orderWithPreference(list, action.preferredLocatorStrategy);
}

function orderWithPreference(
  available: LocatorStrategyKind[],
  preferred?: LocatorStrategyKind
): LocatorStrategyKind[] {
  if (!preferred || !available.includes(preferred)) return available;
  return [preferred, ...available.filter((s) => s !== preferred)];
}

type Root = Page | FrameLocator;

async function trySemanticClick(root: Root, action: RecordedActionLocatorFields, headless?: boolean): Promise<void> {
  const hasRole = !!(action.role && (action.ariaLabel || action.innerText));
  const hasText =
    !!action.innerText && action.innerText.length > 0 && action.innerText.length < 50;

  if (action.role && action.ariaLabel) {
    const locator = root.getByRole(action.role as any, { name: action.ariaLabel });
    if (!headless) await locator.hover({ force: true });
    await locator.click({ force: headless, timeout: 5000 });
  } else if (hasRole && hasText) {
    const locator = root.getByRole(action.role as any, { name: action.innerText!.trim() });
    if (!headless) await locator.hover({ force: true });
    await locator.click({ force: headless, timeout: 5000 });
  } else if (hasText) {
    const locator = root.getByText(action.innerText!.trim());
    if (!headless) await locator.hover({ force: true });
    await locator.click({ force: headless, timeout: 5000 });
  } else {
    throw new Error('semantic strategy not applicable');
  }
}

async function tryCssClick(root: Root, action: RecordedActionLocatorFields, headless?: boolean): Promise<void> {
  if (!action.selector) throw new Error('missing selector');
  const locator = root.locator(action.selector);
  if (!headless) await locator.hover({ force: true });
  await locator.click({ force: headless, timeout: 5000 });
}

async function tryXpathClick(root: Root, action: RecordedActionLocatorFields, headless?: boolean): Promise<void> {
  if (!action.xpath) throw new Error('missing xpath');
  const locator = root.locator(`xpath=${action.xpath}`);
  if (!headless) await locator.hover({ force: true });
  await locator.click({ force: headless });
}

/**
 * Click using the same fallback chain as generated specs, honoring preferredLocatorStrategy.
 * Returns the strategy that succeeded.
 */
export async function clickWithOrderedStrategies(
  page: Page,
  action: RecordedActionLocatorFields,
  options?: { onStrategyUsed?: (strategy: LocatorStrategyKind) => void; headless?: boolean }
): Promise<LocatorStrategyKind> {
  const order = getClickStrategyOrder(action);
  const root: Root = action.frameSelector
    ? page.frameLocator(normalizeSelectorForPlaywright(action.frameSelector))
    : page;

  const pref = action.preferredLocatorStrategy;
  console.log(
    `    📍 Click strategies: ${order.join(' → ')}` +
      (pref ? ` | stored preference: ${pref}` : ' | no stored preference yet')
  );

  const headless = options?.headless ?? false;

  let lastErr: Error | undefined;
  for (const strategy of order) {
    try {
      if (strategy === 'semantic') {
        await trySemanticClick(root, action, headless);
      } else if (strategy === 'css') {
        await tryCssClick(root, action, headless);
      } else {
        await tryXpathClick(root, action, headless);
      }
      options?.onStrategyUsed?.(strategy);
      const firstWorked = strategy === order[0];
      console.log(
        `    ✓ Click succeeded with "${strategy}"` +
          (firstWorked ? ' (first attempt)' : ' (after fallback)') +
          (pref && strategy === pref ? ' — matches stored preference' : '')
      );
      return strategy;
    } catch (e: any) {
      lastErr = e;
      console.log(`    ↪︎ "${strategy}" failed: ${e?.message || e}`);
    }
  }

  // Last resort: JS dispatch click — works even when element is display:none (e.g. hidden nav
  // menus in headless mode where CSS :hover states were never triggered).
  const jsSelector = action.selector || (action.xpath ? `xpath=${action.xpath}` : null);
  if (jsSelector) {
    try {
      console.log(`    ↪︎ Trying JS element.click() dispatch as last resort`);
      const clicked = await page.evaluate((sel: string) => {
        const el = sel.startsWith('xpath=')
          ? document.evaluate(sel.slice(6), document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement | null
          : document.querySelector<HTMLElement>(sel);
        if (!el) return false;
        el.click();
        return true;
      }, jsSelector);
      if (!clicked) throw new Error('element not found via JS dispatch');
      console.log(`    ✓ Click succeeded via JS dispatch (element was not interactable via Playwright)`);
      return 'css';
    } catch (jsErr: any) {
      console.log(`    ↪︎ JS dispatch failed: ${jsErr?.message || jsErr}`);
    }
  }

  throw lastErr ?? new Error('clickWithOrderedStrategies: all strategies failed');
}

/** Fill: css then xpath for radio with xpath; else css only */
export function getFillStrategyOrder(action: RecordedActionLocatorFields): LocatorStrategyKind[] {
  const hasXPath = !!action.xpath;
  const isRadio = action.inputType === 'radio';
  if (isRadio && hasXPath) {
    const list: LocatorStrategyKind[] = ['css', 'xpath'];
    return orderWithPreference(list, action.preferredLocatorStrategy);
  }
  return ['css'];
}

export async function fillWithOrderedStrategies(
  page: Page,
  action: RecordedActionLocatorFields & { value?: string },
  options?: { onStrategyUsed?: (strategy: LocatorStrategyKind) => void }
): Promise<LocatorStrategyKind> {
  const order = getFillStrategyOrder(action);
  const val = action.value ?? '';
  const root: Root = action.frameSelector
    ? page.frameLocator(normalizeSelectorForPlaywright(action.frameSelector))
    : page;

  if (!action.selector) {
    throw new Error('fillWithOrderedStrategies: missing selector');
  }

  const pref = action.preferredLocatorStrategy;
  if (order.length > 1) {
    console.log(
      `    📍 Fill strategies: ${order.join(' → ')}` +
        (pref ? ` | stored preference: ${pref}` : '')
    );
  }

  let lastErr: Error | undefined;
  for (const strategy of order) {
    try {
      if (strategy === 'css') {
        await root.locator(action.selector).fill(val);
      } else {
        if (!action.xpath) throw new Error('missing xpath');
        await root.locator(`xpath=${action.xpath}`).fill(val);
      }
      options?.onStrategyUsed?.(strategy);
      if (order.length > 1) {
        const firstWorked = strategy === order[0];
        console.log(
          `    ✓ Fill succeeded with "${strategy}"` +
            (firstWorked ? ' (first attempt)' : ' (after fallback)') +
            (pref && strategy === pref ? ' — matches stored preference' : '')
        );
      }
      return strategy;
    } catch (e: any) {
      lastErr = e;
      if (order.length > 1) {
        console.log(`    ↪︎ fill "${strategy}" failed: ${e?.message || e}`);
      }
    }
  }
  throw lastErr ?? new Error('fillWithOrderedStrategies: all strategies failed');
}

/** One date field (year/month/day) as stored on datePickerGroup — matches generated spec fallbacks */
export interface DatePickerReplayComponent {
  selector: string;
  xpath?: string;
  elementType: 'select' | 'button' | 'input';
  dropdownSelector?: string;
}

/**
 * Recorded CSS may use :nth-of-type(n), :nth-child(n), or :nth-match(n). Duplicate IDs often make
 * `//*[@id="day"]` match multiple nodes; use the same 0-based index with locator.nth() when falling back to XPath.
 */
export function getDatePickerNthIndexFromCss(cssSelector: string): number | undefined {
  const nthType = cssSelector.match(/:nth-of-type\((\d+)\)/i);
  if (nthType) return Math.max(0, parseInt(nthType[1], 10) - 1);
  const nthChild = cssSelector.match(/:nth-child\((\d+)\)/i);
  if (nthChild) return Math.max(0, parseInt(nthChild[1], 10) - 1);
  const nthMatch = cssSelector.match(/:nth-match\((\d+)\)/i);
  if (nthMatch) return Math.max(0, parseInt(nthMatch[1], 10) - 1);
  return undefined;
}

/**
 * Run an action on the XPath fallback locator; disambiguate duplicate-ID matches using the CSS nth hint,
 * or .first() if strict mode still complains and no hint applies.
 */
async function withDatePickerXpathLocator(
  page: Page,
  comp: DatePickerReplayComponent,
  action: (loc: Locator) => Promise<void>
): Promise<void> {
  const xp = comp.xpath!.trim();
  const base = page.locator(normalizeSelectorForPlaywright(xp));
  const idx = getDatePickerNthIndexFromCss(comp.selector);
  const primary = idx !== undefined ? base.nth(idx) : base;
  try {
    await action(primary);
  } catch (e) {
    const msg = String((e as Error)?.message || e);
    if (!msg.includes('strict mode violation')) throw e;
    if (idx !== undefined) throw e;
    console.log('    ↪︎ xpath matched multiple elements; using .first()');
    await action(base.first());
  }
}

/**
 * Replay for datePickerGroup: try primary CSS locator, then recorded XPath (same idea as generateTestCode try/catch).
 */
export async function replayDatePickerComponent(
  page: Page,
  comp: DatePickerReplayComponent,
  value: string
): Promise<void> {
  if (comp.elementType === 'select') {
    try {
      await page.locator(normalizeSelectorForPlaywright(comp.selector)).selectOption(value, { timeout: 15000 });
    } catch (e) {
      if (!comp.xpath?.trim()) throw e instanceof Error ? e : new Error(String(e));
      console.log(`    ↪︎ date select css failed, trying xpath: ${(e as Error)?.message || e}`);
      await withDatePickerXpathLocator(page, comp, (loc) => loc.selectOption(value));
    }
    return;
  }

  if (comp.elementType === 'input') {
    try {
      await page.locator(normalizeSelectorForPlaywright(comp.selector)).fill(value, { timeout: 15000 });
    } catch (e) {
      if (!comp.xpath?.trim()) throw e instanceof Error ? e : new Error(String(e));
      console.log(`    ↪︎ date fill css failed, trying xpath: ${(e as Error)?.message || e}`);
      await withDatePickerXpathLocator(page, comp, (loc) => loc.fill(value));
    }
    return;
  }

  // button — open, then pick from list (dropdownSelector optional; matches codegen)
  if (comp.selector.includes(':has-text')) {
    const baseSelector = comp.selector.split(':has-text')[0];
    try {
      await page.locator(baseSelector).filter({ hasText: value }).click({ timeout: 15000 });
    } catch (e) {
      if (!comp.xpath?.trim()) throw e instanceof Error ? e : new Error(String(e));
      console.log(`    ↪︎ date button :has-text click failed, trying xpath: ${(e as Error)?.message || e}`);
      await withDatePickerXpathLocator(page, comp, (loc) => loc.click());
    }
  } else {
    try {
      await page.locator(normalizeSelectorForPlaywright(comp.selector)).click({ timeout: 15000 });
    } catch (e) {
      if (!comp.xpath?.trim()) throw e instanceof Error ? e : new Error(String(e));
      console.log(`    ↪︎ date button css click failed, trying xpath: ${(e as Error)?.message || e}`);
      await withDatePickerXpathLocator(page, comp, (loc) => loc.click());
    }
  }

  await page.waitForTimeout(500);

  if (comp.dropdownSelector) {
    const raw = comp.dropdownSelector.trim();
    const scoped = normalizeSelectorForPlaywright(comp.dropdownSelector);
    try {
      await page.locator(scoped).locator(`text="${value}"`).first().click({ timeout: 15000 });
    } catch (e) {
      console.log(`    ↪︎ date dropdown text= failed, trying hasText filter: ${(e as Error)?.message || e}`);
      await page
        .locator(`${raw} a, ${raw} button, ${raw} div, ${raw} li`)
        .filter({ hasText: value })
        .first()
        .click({ timeout: 15000 });
    }
  } else {
    await page.locator('a, button, div, li').filter({ hasText: value }).first().click({ timeout: 15000 });
  }
}

/** Blur last input among day → month → year so change handlers run (matches generated spec). */
/** One row from captureLabeledFields JSON */
export interface CapturedLabeledFieldEntry {
  labelText: string;
  selector: string;
  xpath?: string;
  tagName: string;
  inputType?: string;
  sampleValue?: string;
}

/**
 * Fill a control recorded by captureLabeledFields: CSS locator first, then XPath with nth hint from CSS (same as date replay).
 */
export async function replayCapturedLabeledFieldFill(
  page: Page,
  field: CapturedLabeledFieldEntry,
  value: string
): Promise<void> {
  const tag = (field.tagName || '').toLowerCase();
  const run = async (loc: Locator) => {
    if (tag === 'select') {
      await loc.selectOption(value, { timeout: 15000 });
    } else if (tag === 'textarea') {
      await loc.fill(value, { timeout: 15000 });
    } else {
      await loc.fill(value, { timeout: 15000 });
    }
  };

  try {
    await run(page.locator(normalizeSelectorForPlaywright(field.selector)));
  } catch (e) {
    if (!field.xpath?.trim()) throw e instanceof Error ? e : new Error(String(e));
    console.log(`    ↪︎ labeled field css failed, trying xpath: ${(e as Error)?.message || e}`);
    const base = page.locator(normalizeSelectorForPlaywright(field.xpath));
    const idx = getDatePickerNthIndexFromCss(field.selector);
    const primary = idx !== undefined ? base.nth(idx) : base;
    try {
      await run(primary);
    } catch (e2) {
      const msg = String((e2 as Error)?.message || '');
      if (msg.includes('strict mode violation') && idx === undefined) {
        console.log('    ↪︎ xpath matched multiple elements; using .first()');
        await run(base.first());
      } else {
        throw e2;
      }
    }
  }
}

export async function replayDatePickerBlurLastInput(
  page: Page,
  dateComponents: {
    year?: DatePickerReplayComponent;
    month?: DatePickerReplayComponent;
    day?: DatePickerReplayComponent;
  }
): Promise<void> {
  const keys: Array<'day' | 'month' | 'year'> = ['day', 'month', 'year'];
  for (const key of keys) {
    const comp = dateComponents[key];
    if (comp?.elementType === 'input') {
      try {
        await page.locator(normalizeSelectorForPlaywright(comp.selector)).blur();
      } catch (e) {
        if (!comp.xpath?.trim()) throw e instanceof Error ? e : new Error(String(e));
        console.log(`    ↪︎ date blur css failed, trying xpath: ${(e as Error)?.message || e}`);
        await withDatePickerXpathLocator(page, comp, (loc) => loc.blur());
      }
      await page.waitForTimeout(500);
      return;
    }
  }
}
