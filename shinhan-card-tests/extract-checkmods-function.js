/**
 * Extract checkMods() Function
 *
 * We know:
 * - onkeyup="checkMods(event)"
 * - This function does the encryption
 *
 * Let's extract and analyze it!
 */

const { chromium } = require('playwright-core');
const fs = require('fs');

async function extractCheckMods() {
  console.log('🔍 Extracting checkMods() Function');
  console.log('═'.repeat(70));
  console.log('');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({ locale: 'ko-KR' });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const page = await context.newPage();

  console.log('🌐 Navigating to Shinhan Card...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  console.log('🎯 Clicking password field...');
  await page.locator('[id="pwd"]').click();
  await page.waitForTimeout(2000);

  console.log('');
  console.log('🔍 Searching for checkMods function...');

  const checkModsInfo = await page.evaluate(() => {
    const info = {
      exists: typeof window.checkMods === 'function',
      source: null,
      paramCount: 0,
      fullSource: null
    };

    if (window.checkMods) {
      info.source = window.checkMods.toString();
      info.paramCount = window.checkMods.length;
      info.fullSource = window.checkMods.toString();
    }

    return info;
  });

  if (checkModsInfo.exists) {
    console.log('✅ checkMods() function FOUND!');
    console.log('');
    console.log(`Parameters: ${checkModsInfo.paramCount}`);
    console.log('');
    console.log('Full source code:');
    console.log('═'.repeat(70));
    console.log(checkModsInfo.fullSource);
    console.log('═'.repeat(70));
    console.log('');

    // Save to file for analysis
    fs.writeFileSync('checkMods-function.js', checkModsInfo.fullSource);
    console.log('💾 Saved to: checkMods-function.js');
    console.log('');
  } else {
    console.log('❌ checkMods() function NOT found in window');
    console.log('   It might be in a different scope or closure');
  }

  console.log('═'.repeat(70));
  console.log('🧪 TEST: Can we call checkMods manually?');
  console.log('═'.repeat(70));
  console.log('');

  // Test calling checkMods
  const testResult = await page.evaluate(() => {
    try {
      // Create a fake event
      const fakeEvent = new KeyboardEvent('keyup', {
        key: 'a',
        code: 'KeyA',
        bubbles: true
      });

      // Call checkMods
      window.checkMods(fakeEvent);

      return {
        success: true,
        error: null
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });

  console.log(`Calling checkMods(fakeEvent): ${testResult.success ? '✅ Success' : '❌ Failed'}`);
  if (!testResult.success) {
    console.log(`  Error: ${testResult.error}`);
  }
  console.log('');

  console.log('═'.repeat(70));
  console.log('🔬 DEEP DIVE: Find what checkMods calls');
  console.log('═'.repeat(70));
  console.log('');

  // Search for related functions
  const relatedFunctions = await page.evaluate(() => {
    const funcs = [];

    // Common patterns in encryption code
    const keywords = ['encrypt', 'e2e', 'keypad', 'secure', 'crypto', 'encode'];

    for (let key in window) {
      if (typeof window[key] === 'function') {
        const keyLower = key.toLowerCase();
        if (keywords.some(kw => keyLower.includes(kw))) {
          funcs.push({
            name: key,
            params: window[key].length,
            source: window[key].toString().substring(0, 300)
          });
        }
      }
    }

    return funcs;
  });

  if (relatedFunctions.length > 0) {
    console.log('🔍 Related encryption functions found:');
    console.log('');
    relatedFunctions.forEach(fn => {
      console.log(`  window.${fn.name}(${fn.params} params)`);
      console.log(`    ${fn.source.substring(0, 150)}...`);
      console.log('');
    });
  }

  console.log('═'.repeat(70));
  console.log('💡 NEXT STEPS:');
  console.log('═'.repeat(70));
  console.log('');
  console.log('1. Read checkMods-function.js to understand the logic');
  console.log('2. Find what function it calls for encryption');
  console.log('3. Try calling that function directly with a test password');
  console.log('4. Check if pwd__E2E__ gets populated');
  console.log('');
  console.log('The checkMods function is the KEY to everything!');
  console.log('');

  console.log('Browser stays open (30s)...');
  await page.waitForTimeout(30000);
  await browser.close();

  console.log('');
  console.log('✅ Check the file: checkMods-function.js');
  console.log('   Analyze it and share what you find!');
}

extractCheckMods().catch(console.error);
