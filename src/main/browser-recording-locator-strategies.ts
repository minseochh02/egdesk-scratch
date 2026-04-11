/**
 * Shared locator strategy ordering and Playwright execution for browser recorder
 * replay (in-app) — matches generateTestCode() semantics.
 */
import type { FrameLocator, Page } from 'playwright-core';

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

async function trySemanticClick(root: Root, action: RecordedActionLocatorFields): Promise<void> {
  const hasRole = !!(action.role && (action.ariaLabel || action.innerText));
  const hasText =
    !!action.innerText && action.innerText.length > 0 && action.innerText.length < 50;

  if (action.role && action.ariaLabel) {
    const locator = root.getByRole(action.role as any, { name: action.ariaLabel });
    await locator.hover({ force: true });
    await locator.click({ timeout: 5000 });
  } else if (hasRole && hasText) {
    const locator = root.getByRole(action.role as any, { name: action.innerText!.trim() });
    await locator.hover({ force: true });
    await locator.click({ timeout: 5000 });
  } else if (hasText) {
    const locator = root.getByText(action.innerText!.trim());
    await locator.hover({ force: true });
    await locator.click({ timeout: 5000 });
  } else {
    throw new Error('semantic strategy not applicable');
  }
}

async function tryCssClick(root: Root, action: RecordedActionLocatorFields): Promise<void> {
  if (!action.selector) throw new Error('missing selector');
  const locator = root.locator(action.selector);
  await locator.hover({ force: true });
  await locator.click({ timeout: 5000 });
}

async function tryXpathClick(root: Root, action: RecordedActionLocatorFields): Promise<void> {
  if (!action.xpath) throw new Error('missing xpath');
  const locator = root.locator(`xpath=${action.xpath}`);
  await locator.hover({ force: true });
  await locator.click();
}

/**
 * Click using the same fallback chain as generated specs, honoring preferredLocatorStrategy.
 * Returns the strategy that succeeded.
 */
export async function clickWithOrderedStrategies(
  page: Page,
  action: RecordedActionLocatorFields,
  options?: { onStrategyUsed?: (strategy: LocatorStrategyKind) => void }
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

  let lastErr: Error | undefined;
  for (const strategy of order) {
    try {
      if (strategy === 'semantic') {
        await trySemanticClick(root, action);
      } else if (strategy === 'css') {
        await tryCssClick(root, action);
      } else {
        await tryXpathClick(root, action);
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
