/**
 * Find REAL Encryption Function
 *
 * checkMods() was a red herring - it just checks for Enter key.
 * The REAL encryption must be elsewhere!
 *
 * New strategy:
 * 1. Monitor pwd__E2E__ field continuously
 * 2. Type ONE character
 * 3. See EXACTLY when it changes and what caused it
 */

const { chromium } = require('playwright-core');

async function findRealEncryption() {
  console.log('🔍 Finding REAL Encryption Function');
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

  console.log('🔧 Installing DEEP monitoring hooks...');

  await page.evaluate(() => {
    window.__encryptionTrace__ = [];

    // Hook ALL property setters on pwd__E2E__ field
    const pwdE2EField = document.querySelector('input[name="pwd__E2E__"]');

    if (pwdE2EField) {
      let currentValue = pwdE2EField.value;

      // Override the value property with getter/setter
      Object.defineProperty(pwdE2EField, 'value', {
        get() {
          return currentValue;
        },
        set(newValue) {
          if (newValue !== currentValue) {
            // Capture the full call stack!
            const error = new Error();
            const stack = error.stack;

            window.__encryptionTrace__.push({
              timestamp: Date.now(),
              oldValue: currentValue?.substring(0, 20),
              newValue: newValue?.substring(0, 50),
              callStack: stack,
              caller: stack.split('\n')[2]  // The immediate caller
            });

            console.log('🔥 pwd__E2E__ WAS SET!');
            console.log('New value:', newValue?.substring(0, 40));
            console.log('Call stack:', stack.split('\n').slice(0, 5).join('\n'));
          }

          currentValue = newValue;
        },
        configurable: true
      });

      console.log('[Hook] pwd__E2E__ field setter hooked!');
    }

    // Also hook setAttribute for completeness
    const originalSetAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, value) {
      if (this.name === 'pwd__E2E__' && name === 'value') {
        window.__encryptionTrace__.push({
          type: 'setAttribute',
          timestamp: Date.now(),
          value: value?.substring(0, 50),
          callStack: new Error().stack
        });
      }
      return originalSetAttribute.call(this, name, value);
    };
  });

  console.log('✅ Deep monitoring hooks installed');
  console.log('');

  console.log('🎯 Clicking password field to activate keypad...');
  await page.locator('[id="pwd"]').click();
  await page.waitForTimeout(2000);

  console.log('');
  console.log('═'.repeat(70));
  console.log('🧪 CRITICAL TEST: Type ONE character');
  console.log('═'.repeat(70));
  console.log('');
  console.log('INSTRUCTIONS:');
  console.log('1. Type EXACTLY ONE character in the password field (like "A")');
  console.log('2. Wait 2 seconds (don\'t type more!)');
  console.log('3. Press ENTER here');
  console.log('');
  console.log('The hooks will capture EXACTLY when pwd__E2E__ changes!');
  console.log('');

  await new Promise(resolve => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    readline.question('Press ENTER after typing ONE character: ', () => {
      readline.close();
      resolve();
    });
  });

  console.log('');
  console.log('📊 ANALYZING TRACE...');
  console.log('');

  const trace = await page.evaluate(() => window.__encryptionTrace__ || []);

  if (trace.length > 0) {
    console.log('🎉 SUCCESS! We captured the encryption!');
    console.log('');

    trace.forEach((entry, i) => {
      console.log(`Encryption Call #${i + 1}:`);
      console.log(`  Timestamp: ${entry.timestamp}`);
      console.log(`  New value: ${entry.newValue}`);
      console.log('');
      console.log('  Call Stack:');
      const stackLines = entry.callStack.split('\n').slice(1, 8);
      stackLines.forEach(line => {
        console.log(`    ${line.trim()}`);
      });
      console.log('');
    });

    // Extract function names from stack
    console.log('═'.repeat(70));
    console.log('🎯 FUNCTIONS IN CALL STACK:');
    console.log('═'.repeat(70));
    console.log('');

    const functionNames = new Set();
    trace.forEach(entry => {
      const matches = entry.callStack.match(/at\s+(\w+)/g);
      if (matches) {
        matches.forEach(match => {
          const funcName = match.replace('at ', '').trim();
          if (funcName && funcName !== 'set' && funcName !== 'value') {
            functionNames.add(funcName);
          }
        });
      }
    });

    console.log('Function names found:');
    functionNames.forEach(name => {
      console.log(`  - ${name}()`);
    });

    console.log('');
    console.log('💡 TRY CALLING THESE FUNCTIONS!');
    console.log('   One of these is the encryption function!');

  } else {
    console.log('❌ No encryption trace captured');
    console.log('');
    console.log('This might mean:');
    console.log('  1. Encryption happens in an iframe (can\'t hook from main page)');
    console.log('  2. The field is set using a method we didn\'t hook');
    console.log('  3. Encryption happens on a delay (wait longer)');
  }

  console.log('');
  console.log('Browser stays open (60s) for manual testing...');
  await page.waitForTimeout(60000);
  await browser.close();
}

findRealEncryption().catch(console.error);
