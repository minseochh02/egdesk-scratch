/**
 * Trace __KH_ Field Updates
 *
 * Goal: Hook the __KH_ hidden field to see what code writes to it
 *
 * Strategy:
 * 1. Hook the field's value setter
 * 2. Capture stack trace when it's updated
 * 3. See which function processes the button hash
 */

const { chromium } = require('playwright-core');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function waitForEnter(message) {
  return new Promise((resolve) => {
    rl.question(`\n${message}\nPress ENTER to continue...`, () => {
      resolve();
    });
  });
}

(async () => {
  console.log('🔍 Trace __KH_ Field Updates\n');
  console.log('═'.repeat(70));
  console.log('');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({ locale: 'ko-KR' });
  const page = await context.newPage();

  console.log('🌐 Navigating to Shinhan Card...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  console.log('🎯 Clicking password field...');
  await page.locator('#pwd').click();
  await page.waitForTimeout(3000);

  // Find and hook the __KH_ field
  console.log('🔗 Hooking __KH_ field setter...');

  const hookResult = await page.evaluate(() => {
    // Find the __KH_ field
    const khFields = document.querySelectorAll('input[name^="__KH_"]');

    if (khFields.length === 0) {
      return { success: false, message: 'No __KH_ fields found' };
    }

    const khField = khFields[0];
    const fieldName = khField.name;

    window.__khUpdates__ = [];

    // Hook the value property
    const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

    Object.defineProperty(khField, 'value', {
      get: function() {
        return originalDescriptor.get.call(this);
      },
      set: function(newValue) {
        const oldValue = originalDescriptor.get.call(this);

        // Log the update
        const update = {
          timestamp: Date.now(),
          oldValue: oldValue,
          newValue: newValue,
          valueChange: newValue.length - oldValue.length,
          stackTrace: new Error().stack
        };

        window.__khUpdates__.push(update);

        console.log(`🔥 __KH_ field updated!`);
        console.log(`   Old length: ${oldValue.length}`);
        console.log(`   New length: ${newValue.length}`);
        console.log(`   Change: +${newValue.length - oldValue.length} chars`);

        if (newValue.length > oldValue.length) {
          const added = newValue.substring(oldValue.length);
          console.log(`   Added: ${added.substring(0, 50)}...`);
        }

        return originalDescriptor.set.call(this, newValue);
      }
    });

    return {
      success: true,
      message: `Hooked ${fieldName}`,
      fieldName: fieldName
    };
  });

  if (!hookResult.success) {
    console.log(`❌ ${hookResult.message}`);
    await browser.close();
    rl.close();
    process.exit(1);
  }

  console.log(`✅ ${hookResult.message}`);
  console.log('');

  // Monitor console for our logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('__KH_')) {
      console.log(`[Browser] ${text}`);
    }
  });

  console.log('═'.repeat(70));
  console.log('🧪 TEST: Click virtual keypad button');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Now click ONE button on the virtual keypad');
  console.log('Watch the console above for field update logs!');
  console.log('');

  await waitForEnter('Press ENTER after clicking a button');

  // Get captured updates
  const updates = await page.evaluate(() => window.__khUpdates__ || []);

  console.log('');
  console.log('═'.repeat(70));
  console.log('📊 CAPTURED UPDATES');
  console.log('═'.repeat(70));
  console.log('');

  console.log(`Total __KH_ field updates: ${updates.length}`);
  console.log('');

  if (updates.length > 0) {
    updates.forEach((update, idx) => {
      console.log(`Update ${idx + 1}:`);
      console.log(`  Old value: ${update.oldValue.length} chars`);
      console.log(`  New value: ${update.newValue.length} chars`);
      console.log(`  Added: ${update.valueChange} chars`);
      console.log('');

      if (update.valueChange > 0) {
        const added = update.newValue.substring(update.oldValue.length);
        console.log(`  New data: ${added.substring(0, 60)}...`);
        console.log('');
      }

      console.log('  Stack trace:');
      const stackLines = update.stackTrace.split('\n').slice(1, 8);
      stackLines.forEach(line => {
        console.log(`    ${line.trim()}`);
      });

      console.log('');
      console.log('─'.repeat(70));
      console.log('');
    });

    // Save updates
    fs.writeFileSync('kh-field-updates.json', JSON.stringify(updates, null, 2));
    console.log('💾 Saved updates to: kh-field-updates.json');
    console.log('');

    console.log('🔍 ANALYSIS:');
    console.log('');
    console.log('Look at the stack trace to find:');
    console.log('  - Which function called the setter');
    console.log('  - File/line number of the code');
    console.log('  - Function names in call chain');
    console.log('');
    console.log('This shows us the hash processing logic!');

  } else {
    console.log('⚠️  No updates captured');
    console.log('   The field might update through different mechanism');
    console.log('   Or click didn\'t register');
  }

  console.log('');
  await waitForEnter('Press ENTER to close browser');

  await browser.close();
  rl.close();

  process.exit(0);
})();
