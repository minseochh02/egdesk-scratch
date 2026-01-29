/**
 * Who Does the Encryption? Kernel vs Browser Test
 *
 * We need to determine:
 * - Does the KERNEL DRIVER encrypt and inject values?
 * - Or does BROWSER JavaScript encrypt via event listeners?
 *
 * Test Method:
 * 1. Check if event listeners exist on password field
 * 2. Remove ALL event listeners
 * 3. Type a character manually
 * 4. See if pwd__E2E__ still gets updated
 *
 * If YES → Kernel driver does it (we can't intercept)
 * If NO → Browser does it (we CAN intercept!)
 */

const { chromium } = require('playwright-core');

async function testWhoEncrypts() {
  console.log('🔬 Kernel vs Browser Encryption Test');
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

  console.log('🎯 Clicking password field to activate keypad...');
  await page.locator('[id="pwd"]').click();
  await page.waitForTimeout(2000);

  console.log('');
  console.log('═'.repeat(70));
  console.log('TEST 1: Check for Event Listeners');
  console.log('═'.repeat(70));
  console.log('');

  // Check what event listeners are attached
  const listenerCheck = await page.evaluate(() => {
    const pwdField = document.getElementById('pwd');
    const result = {
      hasListeners: {
        keydown: false,
        keyup: false,
        keypress: false,
        input: false,
        change: false
      },
      eventHandlers: {},
      clonedField: null
    };

    // Check inline handlers (onkeydown, onkeyup, etc.)
    ['keydown', 'keyup', 'keypress', 'input', 'change'].forEach(event => {
      result.hasListeners[event] = pwdField[`on${event}`] !== null;
      if (pwdField[`on${event}`]) {
        result.eventHandlers[event] = pwdField[`on${event}`].toString().substring(0, 200);
      }
    });

    // Note: Can't directly inspect addEventListener listeners in Chrome
    // But we can clone the element (which removes listeners)
    result.canClone = true;

    return result;
  });

  console.log('Event listeners check:');
  Object.entries(listenerCheck.hasListeners).forEach(([event, exists]) => {
    console.log(`  on${event}: ${exists ? '✅ YES' : '❌ NO'}`);
    if (exists && listenerCheck.eventHandlers[event]) {
      console.log(`    Handler: ${listenerCheck.eventHandlers[event].substring(0, 100)}...`);
    }
  });
  console.log('');

  console.log('═'.repeat(70));
  console.log('TEST 2: Remove Event Listeners (Clone Field)');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Strategy: Clone the password field (removes all event listeners)');
  console.log('Then type in the cloned field to see if encryption still happens');
  console.log('');

  // Clone field to remove listeners
  const cloneResult = await page.evaluate(() => {
    try {
      const original = document.getElementById('pwd');
      const clone = original.cloneNode(true);

      // Keep the same ID and attributes
      clone.id = 'pwd';
      original.id = 'pwd-original-disabled';
      original.style.display = 'none';

      // Insert clone
      original.parentNode.insertBefore(clone, original.nextSibling);

      // Remove ALL inline event handlers from clone
      ['onkeydown', 'onkeyup', 'onkeypress', 'oninput', 'onchange', 'onfocus', 'onblur'].forEach(handler => {
        clone[handler] = null;
      });

      return {
        success: true,
        message: 'Field cloned, all event listeners removed'
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });

  if (cloneResult.success) {
    console.log('✅ Password field cloned successfully');
    console.log('   Original field hidden, clone has NO event listeners');
  } else {
    console.log('❌ Clone failed:', cloneResult.error);
  }

  console.log('');
  console.log('═'.repeat(70));
  console.log('🧪 CRITICAL TEST: Type in the cloned field');
  console.log('═'.repeat(70));
  console.log('');
  console.log('INSTRUCTIONS:');
  console.log('1. Click the password field (should be the cloned one)');
  console.log('2. Type a test password (like: Test123)');
  console.log('3. Watch the hidden fields!');
  console.log('4. Press ENTER here when done');
  console.log('');
  console.log('What we\'re testing:');
  console.log('  - If pwd__E2E__ updates → Kernel driver does encryption ✅');
  console.log('  - If pwd__E2E__ stays empty → Browser JS does encryption ❌');
  console.log('');

  await new Promise(resolve => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    readline.question('Press ENTER after typing in cloned field: ', () => {
      readline.close();
      resolve();
    });
  });

  console.log('');
  console.log('🔍 Checking if encryption happened...');

  const afterTyping = await page.evaluate(() => {
    return {
      clonedFieldValue: document.getElementById('pwd')?.value || '',
      pwdE2E: document.querySelector('input[name="pwd__E2E__"]')?.value || '(empty)',
      e2eResult: document.querySelector('input[name="__E2E_RESULT__"]')?.value || '(empty)'
    };
  });

  console.log('');
  console.log('═'.repeat(70));
  console.log('📊 RESULTS:');
  console.log('═'.repeat(70));
  console.log('');
  console.log(`Cloned field value: "${afterTyping.clonedFieldValue}"`);
  console.log(`pwd__E2E__ field: ${afterTyping.pwdE2E.substring(0, 50)}...`);
  console.log(`__E2E_RESULT__ field: ${afterTyping.e2eResult.substring(0, 50)}...`);
  console.log('');

  const wasEncrypted = afterTyping.pwdE2E !== '(empty)';

  console.log('═'.repeat(70));
  console.log('🎯 CONCLUSION:');
  console.log('═'.repeat(70));
  console.log('');

  if (wasEncrypted) {
    console.log('✅ ENCRYPTION STILL HAPPENED!');
    console.log('');
    console.log('This means:');
    console.log('  ✅ KERNEL DRIVER does the encryption');
    console.log('  ✅ Browser event listeners are NOT required');
    console.log('  ✅ Encryption happens at OS/kernel level');
    console.log('');
    console.log('Implications:');
    console.log('  ❌ We cannot intercept the encryption in JavaScript');
    console.log('  ❌ We cannot call an encryption function from browser');
    console.log('  ❌ Browser has no control over this process');
    console.log('');
    console.log('Options remaining:');
    console.log('  1. Trigger kernel driver encryption somehow');
    console.log('  2. Simulate the exact sequence kernel driver expects');
    console.log('  3. Hardware USB device (kernel sees it as real keyboard)');
    console.log('  4. Find if kernel driver has a communication API');
    console.log('');
  } else {
    console.log('❌ ENCRYPTION DID NOT HAPPEN!');
    console.log('');
    console.log('This means:');
    console.log('  ✅ BROWSER JavaScript does the encryption');
    console.log('  ✅ Event listeners are REQUIRED');
    console.log('  ✅ We can intercept/call the encryption function');
    console.log('');
    console.log('Implications:');
    console.log('  ✅ We can find and call the encryption function!');
    console.log('  ✅ Fully automated solution is possible!');
    console.log('  ✅ No hardware needed!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Find the event listener function');
    console.log('  2. Extract the encryption logic');
    console.log('  3. Call it from Playwright');
    console.log('  4. Set encrypted value');
    console.log('  5. Submit form → Success! ✅');
    console.log('');
  }

  console.log('═'.repeat(70));
  console.log('');

  await page.waitForTimeout(10000);
  await browser.close();
}

testWhoEncrypts().catch(console.error);
