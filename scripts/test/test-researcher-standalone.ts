/**
 * Standalone RESEARCHER Test
 * Tests browser automation pattern without Electron dependencies
 */

import { chromium, Browser, Page } from 'playwright-core';

// Simple compact snapshot implementation (without accessibility API)
async function getCompactSnapshot(page: Page) {
  console.log('  Scanning page for interactive elements...');

  const elements: any[] = [];
  let counter = 0;

  // Get all interactive elements using Playwright's semantic locators
  const interactiveSelectors = [
    { role: 'button', selector: 'button, [role="button"], input[type="button"], input[type="submit"]' },
    { role: 'link', selector: 'a[href]' },
    { role: 'textbox', selector: 'input[type="text"], input[type="email"], input[type="search"], textarea' },
    { role: 'checkbox', selector: 'input[type="checkbox"]' },
  ];

  for (const { role, selector } of interactiveSelectors) {
    const locators = await page.locator(selector).all();

    for (const locator of locators) {
      const isVisible = await locator.isVisible().catch(() => false);
      if (!isVisible) continue;

      const text = await locator.textContent().catch(() => '');
      const ariaLabel = await locator.getAttribute('aria-label').catch(() => '');
      const name = text?.trim() || ariaLabel || '';

      if (name || role === 'textbox') {
        elements.push({
          id: `@e${++counter}`,
          role,
          name: name.substring(0, 50), // Limit length
        });
      }
    }
  }

  return {
    elements,
    tokenEstimate: Math.ceil(JSON.stringify(elements).length / 4),
  };
}

async function main() {
  console.log('='.repeat(60));
  console.log('RESEARCHER TEST: Hardcoded "모빌금액" Research Scenario');
  console.log('='.repeat(60));

  console.log('\n📋 Scenario:');
  console.log('ROOKIE asked: "What does 모빌금액 mean?"');
  console.log('ROOKIE found: Excel has 공급가액, 합 계 for Mobil products');
  console.log('ROOKIE question: "Is 모빌금액 the same as sum of Mobil sales?"');
  console.log('\nRESEARCHER will search a test website for clarification...\n');

  console.log('🚀 Launching browser...\n');

  // Launch browser (will try to find Chrome)
  let browser: Browser;
  try {
    // Try common Chrome paths on macOS
    const chromePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];

    let chromePath = chromePaths.find((p) => {
      const fs = require('fs');
      return fs.existsSync(p);
    });

    if (!chromePath) {
      console.log('⚠️  Chrome not found at common paths, using bundled Chromium');
      browser = await chromium.launch({ headless: false });
    } else {
      console.log('✓ Found Chrome at:', chromePath);
      browser = await chromium.launch({
        headless: false,
        executablePath: chromePath,
      });
    }
  } catch (error) {
    console.error('❌ Failed to launch browser:', error);
    return;
  }

  const page = await browser.newPage();

  console.log('📄 Navigating to test site...\n');
  console.log('💡 In real usage, this would be an ERP/banking site with documentation\n');
  await page.goto('https://example.com');

  console.log('📸 Taking compact snapshot (agent-browser style)...\n');
  const snapshot = await getCompactSnapshot(page);

  console.log('='.repeat(60));
  console.log('SNAPSHOT RESULTS (Compact Format)');
  console.log('='.repeat(60));
  console.log(`URL: ${page.url()}`);
  console.log(`Title: ${await page.title()}`);
  console.log(`Elements: ${snapshot.elements.length}`);
  console.log(`Estimated tokens: ~${snapshot.tokenEstimate}`);
  console.log('\nInteractive elements found:');
  console.log(JSON.stringify(snapshot.elements, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('CONTEXT SAVINGS COMPARISON');
  console.log('='.repeat(60));

  // Compare with full DOM approach
  const fullDOM = await page.content();
  const fullDOMTokens = Math.ceil(fullDOM.length / 4);

  console.log(`Full DOM approach: ~${fullDOMTokens.toLocaleString()} tokens`);
  console.log(`Compact snapshot: ~${snapshot.tokenEstimate} tokens`);
  const savings = ((1 - snapshot.tokenEstimate / fullDOMTokens) * 100).toFixed(1);
  console.log(`Context savings: ${savings}% 🎉`);

  console.log('\n✅ Test complete! Closing browser...');
  await browser.close();
}

main().catch(console.error);
