/**
 * Definitive Test: Kernel vs Browser Encryption
 *
 * We need to determine WHO actually does the encryption:
 * A) Kernel driver (TKFWVT64.sys) - intercepts keyboard, encrypts, injects into browser
 * B) Browser JavaScript - captures keystrokes, sends to WebSocket, gets encrypted response
 *
 * CRITICAL TEST:
 * If we can open DevTools and monitor the pwd__E2E__ field while typing,
 * we can see if JavaScript has access to set it or if it's set externally.
 */

const { chromium } = require('playwright-core');

async function testKernelVsBrowser() {
  console.log('🔬 Kernel vs Browser Encryption - Definitive Test');
  console.log('═'.repeat(70));
  console.log('');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--auto-open-devtools-for-tabs'  // Try to force DevTools open
    ]
  });

  const context = await browser.newContext({ locale: 'ko-KR' });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });

    // Ultimate hook - Object.defineProperty on the actual field
    window.__fieldSetAttempts__ = [];

    // Wait for field to exist, then hook it
    const hookField = () => {
      const field = document.querySelector('input[name="pwd__E2E__"]');
      if (!field) {
        setTimeout(hookField, 100);
        return;
      }

      console.log('🔧 Hooking pwd__E2E__ field at deepest level...');

      // Store original descriptor
      const originalDescriptor = Object.getOwnPropertyDescriptor(field, 'value') ||
                                 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

      // Define new property
      let internalValue = field.value || '';

      Object.defineProperty(field, 'value', {
        get() {
          return internalValue;
        },
        set(newValue) {
          // Log EVERY attempt to set this field
          const setInfo = {
            timestamp: Date.now(),
            oldValue: internalValue?.substring(0, 30),
            newValue: newValue?.substring(0, 50),
            stackTrace: new Error().stack,
            calledFromJavaScript: true  // If we're here, JS is setting it
          };

          window.__fieldSetAttempts__.push(setInfo);

          console.log('🔥 pwd__E2E__ SET DETECTED!');
          console.log('New value:', newValue?.substring(0, 40));
          console.log('Called from JavaScript:', true);
          console.log('Stack:', new Error().stack.split('\n').slice(1, 4).join('\n'));

          internalValue = newValue;
        },
        configurable: true
      });

      console.log('✅ pwd__E2E__ field hooked!');
    };

    // Start hooking
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', hookField);
    } else {
      hookField();
    }
  });

  const page = await context.newPage();

  console.log('🌐 Navigating to Shinhan Card...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  console.log('🎯 Clicking password field...');
  await page.locator('[id="pwd"]').click();
  await page.waitForTimeout(2000);

  console.log('');
  console.log('═'.repeat(70));
  console.log('🧪 DEFINITIVE TEST');
  console.log('═'.repeat(70));
  console.log('');
  console.log('INSTRUCTIONS:');
  console.log('1. Type EXACTLY the letter "g"');
  console.log('2. Wait 2 seconds');
  console.log('3. Press ENTER here');
  console.log('');
  console.log('Watch the browser console for "🔥 pwd__E2E__ SET DETECTED!" message');
  console.log('');
  console.log('What this proves:');
  console.log('  - If we see "SET DETECTED" → Browser JavaScript sets it ✅');
  console.log('  - If we DON\'T see it → Kernel driver sets it directly ❌');
  console.log('');

  await new Promise(resolve => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    readline.question('Press ENTER after typing: ', () => {
      readline.close();
      resolve();
    });
  });

  console.log('');
  console.log('📊 ANALYZING RESULTS...');
  console.log('');

  const fieldSets = await page.evaluate(() => window.__fieldSetAttempts__ || []);

  console.log(`Field set attempts captured: ${fieldSets.length}`);
  console.log('');

  if (fieldSets.length > 0) {
    console.log('═'.repeat(70));
    console.log('✅ BROWSER JAVASCRIPT SETS THE FIELD!');
    console.log('═'.repeat(70));
    console.log('');

    fieldSets.forEach((attempt, i) => {
      console.log(`Set Attempt #${i + 1}:`);
      console.log(`  New value: ${attempt.newValue}`);
      console.log(`  Called from JavaScript: ${attempt.calledFromJavaScript}`);
      console.log('  Call Stack:');
      const stackLines = attempt.stackTrace.split('\n').slice(1, 6);
      stackLines.forEach(line => console.log(`    ${line.trim()}`));
      console.log('');
    });

    console.log('CONCLUSION:');
    console.log('  ✅ Browser JavaScript DOES set pwd__E2E__ field');
    console.log('  ✅ Kernel driver is NOT directly injecting values');
    console.log('  ✅ We can intercept this in JavaScript!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Find the function in the call stack');
    console.log('  2. Extract and analyze it');
    console.log('  3. Call it from our automation');
    console.log('');

  } else {
    console.log('═'.repeat(70));
    console.log('❌ NO JAVASCRIPT CALLS DETECTED!');
    console.log('═'.repeat(70));
    console.log('');

    // But check if field was set anyway
    const fieldValue = await page.evaluate(() => {
      return document.querySelector('input[name="pwd__E2E__"]')?.value || null;
    });

    if (fieldValue) {
      console.log('⚠️  MYSTERY: Field WAS set but not via JavaScript!');
      console.log(`  Value: ${fieldValue.substring(0, 50)}...`);
      console.log('');
      console.log('CONCLUSION:');
      console.log('  ✅ KERNEL DRIVER sets the field directly!');
      console.log('  ✅ Bypasses JavaScript entirely');
      console.log('  ✅ Browser has no control over this');
      console.log('');
      console.log('Implications:');
      console.log('  ❌ Cannot intercept in JavaScript');
      console.log('  ❌ Cannot call encryption from browser');
      console.log('  ❌ Software automation extremely difficult');
      console.log('');
      console.log('Options:');
      console.log('  1. Hardware USB device (USB Rubber Ducky)');
      console.log('  2. Communicate with nProtect service directly');
      console.log('  3. Reverse engineer kernel driver (extremely hard)');
      console.log('');
    } else {
      console.log('⚠️  Field was NOT set');
      console.log('  Maybe the character didn\'t register?');
      console.log('  Try typing again manually');
    }
  }

  console.log('Browser stays open (60s) - check console logs!');
  await page.waitForTimeout(60000);
  await browser.close();
}

testKernelVsBrowser().catch(console.error);
