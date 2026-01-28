/**
 * Find E2E Encryption Function
 *
 * Since replay doesn't work (session-specific encryption), we need to find
 * the JavaScript function that CREATES the encrypted value.
 *
 * Strategy:
 * 1. Monitor what changes when you type a character
 * 2. Hook into JavaScript to intercept encryption
 * 3. Find the function that generates pwd__E2E__
 */

const { chromium } = require('playwright-core');

async function findEncryptionFunction() {
  console.log('🔍 E2E Encryption Function Finder');
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

  console.log('');
  console.log('🔧 Installing monitoring hooks...');

  // Install comprehensive hooks
  await page.evaluate(() => {
    window.__encryptionLogs__ = [];

    // Hook 1: Monitor all hidden field changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.type === 'attributes' &&
            mutation.attributeName === 'value' &&
            mutation.target.name &&
            mutation.target.name.includes('E2E')) {
          window.__encryptionLogs__.push({
            type: 'FIELD_CHANGE',
            fieldName: mutation.target.name,
            newValue: mutation.target.value?.substring(0, 40),
            timestamp: Date.now()
          });
        }
      });
    });

    // Observe all input fields
    document.querySelectorAll('input').forEach(input => {
      observer.observe(input, { attributes: true });
    });

    // Hook 2: Intercept property setters on hidden fields
    document.querySelectorAll('input[type="hidden"]').forEach(field => {
      if (field.name && field.name.includes('E2E')) {
        let originalValue = field.value;

        Object.defineProperty(field, 'value', {
          get() {
            return originalValue;
          },
          set(newValue) {
            if (newValue !== originalValue) {
              window.__encryptionLogs__.push({
                type: 'VALUE_SETTER',
                fieldName: field.name,
                oldValue: originalValue?.substring(0, 20),
                newValue: newValue?.substring(0, 40),
                stack: new Error().stack?.split('\n').slice(2, 5).join('\n'),
                timestamp: Date.now()
              });

              // Try to capture the calling function
              try {
                const stack = new Error().stack;
                const callerMatch = stack.match(/at\s+(\w+)/g);
                if (callerMatch && callerMatch[1]) {
                  window.__encryptionLogs__.push({
                    type: 'CALLER_FUNCTION',
                    function: callerMatch[1],
                    fullStack: stack
                  });
                }
              } catch (e) {}
            }
            originalValue = newValue;
          },
          configurable: true
        });
      }
    });

    // Hook 3: Search for E2E objects and functions
    window.__findE2EFunctions__ = () => {
      const found = {
        objects: [],
        functions: [],
        jqueryPlugins: []
      };

      // Search window
      for (let key in window) {
        const keyLower = key.toLowerCase();
        if (keyLower.includes('e2e') || keyLower.includes('encrypt') || keyLower.includes('keypad')) {
          if (typeof window[key] === 'function') {
            found.functions.push({
              name: key,
              signature: window[key].toString().substring(0, 200),
              paramCount: window[key].length
            });
          } else if (typeof window[key] === 'object' && window[key]) {
            found.objects.push({
              name: key,
              methods: Object.keys(window[key]).filter(k => typeof window[key][k] === 'function')
            });
          }
        }
      }

      // Check jQuery plugins
      if (window.jQuery || window.$) {
        const $ = window.jQuery || window.$;
        if ($.fn) {
          for (let key in $.fn) {
            const keyLower = key.toLowerCase();
            if (keyLower.includes('e2e') || keyLower.includes('keypad') || keyLower.includes('encrypt')) {
              found.jqueryPlugins.push(key);
            }
          }
        }
      }

      return found;
    };

    console.log('[Hooks] Monitoring installed ✅');
  });

  console.log('✅ Monitoring hooks installed');
  console.log('');

  console.log('🎯 Clicking password field...');
  await page.locator('[id="pwd"]').click();
  await page.waitForTimeout(2000);

  console.log('');
  console.log('🔍 Searching for E2E functions NOW (after keypad loaded)...');

  const e2eFunctions = await page.evaluate(() => {
    return window.__findE2EFunctions__();
  });

  console.log('');
  console.log('📊 FUNCTIONS FOUND:');
  console.log('');

  if (e2eFunctions.objects.length > 0) {
    console.log('🎯 E2E OBJECTS:');
    e2eFunctions.objects.forEach(obj => {
      console.log(`   window.${obj.name}`);
      console.log(`     Methods: ${obj.methods.join(', ')}`);
      console.log('');
    });
  }

  if (e2eFunctions.functions.length > 0) {
    console.log('🎯 E2E FUNCTIONS:');
    e2eFunctions.functions.forEach(fn => {
      console.log(`   window.${fn.name}(${fn.paramCount} params)`);
      console.log(`     ${fn.signature.substring(0, 150)}...`);
      console.log('');
    });
  }

  if (e2eFunctions.jqueryPlugins.length > 0) {
    console.log('🎯 JQUERY PLUGINS:');
    e2eFunctions.jqueryPlugins.forEach(plugin => {
      console.log(`   $.fn.${plugin}()`);
    });
    console.log('');
  }

  console.log('═'.repeat(70));
  console.log('🧪 EXPERIMENT: Type ONE character and see what gets called');
  console.log('═'.repeat(70));
  console.log('');
  console.log('INSTRUCTIONS:');
  console.log('1. Type JUST ONE CHARACTER in the password field (like "A")');
  console.log('2. Wait 2 seconds');
  console.log('3. Press ENTER here');
  console.log('');
  console.log('This will show us which function handles encryption!');
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

  // Check logs
  console.log('');
  console.log('📝 ENCRYPTION LOGS:');
  console.log('');

  const logs = await page.evaluate(() => window.__encryptionLogs__ || []);

  if (logs.length > 0) {
    logs.forEach(log => {
      console.log(`[${log.type}] ${log.fieldName || ''}`);
      if (log.stack) {
        console.log('  Call stack:');
        console.log(log.stack.split('\n').slice(0, 3).join('\n'));
      }
      if (log.function) {
        console.log(`  Caller: ${log.function}`);
      }
      console.log('');
    });
  } else {
    console.log('❌ No encryption calls intercepted');
    console.log('   The function might not be setting values directly');
    console.log('');
  }

  console.log('═'.repeat(70));
  console.log('🔬 ADVANCED: Searching all loaded scripts for "E2E"');
  console.log('═'.repeat(70));
  console.log('');

  // Get all script sources
  const scripts = await page.evaluate(() => {
    return Array.from(document.scripts)
      .map(script => ({
        src: script.src,
        inline: !script.src,
        length: script.textContent?.length || 0,
        hasE2E: script.textContent?.includes('E2E') || script.textContent?.includes('e2e'),
        hasEncrypt: script.textContent?.includes('encrypt') || script.textContent?.includes('crypt')
      }))
      .filter(s => s.hasE2E || s.hasEncrypt);
  });

  console.log('📄 Scripts containing E2E/encrypt:');
  scripts.forEach(script => {
    if (script.src) {
      console.log(`   External: ${script.src}`);
    } else {
      console.log(`   Inline script (${script.length} bytes)`);
    }
    console.log(`     Contains E2E: ${script.hasE2E ? '✅' : '❌'}`);
    console.log(`     Contains encrypt: ${script.hasEncrypt ? '✅' : '❌'}`);
    console.log('');
  });

  console.log('');
  console.log('═'.repeat(70));
  console.log('💡 NEXT STEPS TO FIND ENCRYPTION FUNCTION:');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Based on logs above:');
  console.log('');

  if (logs.length > 0) {
    console.log('✅ We intercepted encryption calls!');
    console.log('   Check the call stack to find the function name');
    console.log('   Search for that function in browser console');
    console.log('');
  } else {
    console.log('⚠️  No direct calls intercepted. The encryption might:');
    console.log('   1. Use event listeners (keydown/keyup)');
    console.log('   2. Be in an iframe');
    console.log('   3. Use a timer/debounce');
    console.log('');
  }

  if (scripts.length > 0) {
    console.log('💡 Download and search these scripts:');
    scripts.forEach(s => {
      if (s.src) {
        console.log(`   curl "${s.src}" > script.js`);
        console.log(`   grep -i "function.*encrypt" script.js`);
      }
    });
    console.log('');
  }

  console.log('Browser will stay open for 60 seconds...');
  console.log('Try calling functions you found in the console!');
  console.log('');

  await page.waitForTimeout(60000);
  await browser.close();
}

findEncryptionFunction().catch(console.error);
