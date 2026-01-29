/**
 * Keypad API Explorer
 *
 * We found:
 * - window.npKeyPadMaker (function)
 * - $.fn.keypad() (jQuery plugin)
 * - pwd__E2E__ gets updated when typing
 *
 * Now let's explore the keypad API and find how to call it!
 */

const { chromium } = require('playwright-core');

async function exploreKeypadAPI() {
  console.log('🔍 Keypad API Explorer');
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

  console.log('🎯 Clicking password field to load keypad...');
  await page.locator('[id="pwd"]').click();
  await page.waitForTimeout(2000);

  console.log('');
  console.log('🔍 Analyzing jQuery keypad plugin...');
  console.log('');

  const keypadAnalysis = await page.evaluate(() => {
    const result = {
      hasJQuery: !!window.jQuery || !!window.$,
      keypadPlugin: null,
      keypadMethods: [],
      passwordFieldData: {},
      tryCallKeypad: null
    };

    if (window.jQuery || window.$) {
      const $ = window.jQuery || window.$;

      // Check if keypad plugin exists
      if ($.fn && $.fn.keypad) {
        result.keypadPlugin = {
          exists: true,
          toString: $.fn.keypad.toString().substring(0, 500)
        };

        // Get all methods/properties
        result.keypadMethods = Object.keys($.fn.keypad);
      }

      // Check what data is attached to password field
      const pwdField = $('#pwd');
      if (pwdField.length > 0) {
        result.passwordFieldData = {
          data: pwdField.data(),
          hasKeypadData: !!pwdField.data('keypad'),
          keypadInstance: pwdField.data('keypad') ? Object.keys(pwdField.data('keypad')) : null
        };
      }

      // Try to get the keypad instance
      try {
        const keypadInstance = $('#pwd').data('keypad');
        if (keypadInstance) {
          result.tryCallKeypad = {
            instanceExists: true,
            methods: Object.keys(keypadInstance).filter(k => typeof keypadInstance[k] === 'function'),
            properties: Object.keys(keypadInstance).filter(k => typeof keypadInstance[k] !== 'function')
          };
        }
      } catch (e) {
        result.tryCallKeypad = { error: e.message };
      }
    }

    return result;
  });

  console.log('📊 JQUERY KEYPAD ANALYSIS:');
  console.log('');

  if (keypadAnalysis.hasJQuery) {
    console.log('✅ jQuery is loaded');

    if (keypadAnalysis.keypadPlugin) {
      console.log('✅ $.fn.keypad plugin EXISTS!');
      console.log('');
      console.log('Plugin code preview:');
      console.log(keypadAnalysis.keypadPlugin.toString);
      console.log('');
    }

    if (keypadAnalysis.passwordFieldData.hasKeypadData) {
      console.log('✅ Password field has keypad data attached!');
      console.log('   Data:', JSON.stringify(keypadAnalysis.passwordFieldData.data, null, 2));
      console.log('');
    }

    if (keypadAnalysis.tryCallKeypad && keypadAnalysis.tryCallKeypad.instanceExists) {
      console.log('🎯 KEYPAD INSTANCE FOUND ON PASSWORD FIELD!');
      console.log('');
      console.log('   Available methods:');
      keypadAnalysis.tryCallKeypad.methods.forEach(method => {
        console.log(`     $('#pwd').data('keypad').${method}()`);
      });
      console.log('');
      console.log('   Properties:');
      keypadAnalysis.tryCallKeypad.properties.forEach(prop => {
        console.log(`     $('#pwd').data('keypad').${prop}`);
      });
      console.log('');
    }
  }

  console.log('═'.repeat(70));
  console.log('🧪 EXPERIMENT: Try to call keypad methods');
  console.log('═'.repeat(70));
  console.log('');

  // Try common method names
  const methodTests = [
    "$.fn.keypad.setValue",
    "$.fn.keypad.encrypt",
    "$('#pwd').data('keypad').setValue",
    "$('#pwd').data('keypad').encrypt",
    "$('#pwd').data('keypad').setPassword",
    "$('#pwd').keypad('setValue', 'Test123')",
    "$('#pwd').keypad('encrypt', 'Test123')",
    "$('#pwd').keypad('getEncrypted')",
    "window.npKeyPadMaker",
  ];

  console.log('Testing common method patterns:');
  console.log('');

  for (const testCode of methodTests) {
    const testResult = await page.evaluate((code) => {
      try {
        const result = eval(code);
        return {
          code,
          success: true,
          result: typeof result === 'string' ? result : JSON.stringify(result),
          type: typeof result
        };
      } catch (e) {
        return {
          code,
          success: false,
          error: e.message
        };
      }
    }, testCode);

    if (testResult.success) {
      console.log(`✅ ${testResult.code}`);
      console.log(`   Result (${testResult.type}): ${testResult.result?.substring(0, 100)}`);
      console.log('');
    } else {
      console.log(`❌ ${testResult.code}`);
      console.log(`   Error: ${testResult.error}`);
      console.log('');
    }
  }

  console.log('═'.repeat(70));
  console.log('🔬 FINAL TEST: Get encrypted value programmatically');
  console.log('═'.repeat(70));
  console.log('');
  console.log('INSTRUCTIONS:');
  console.log('1. Clear the password field');
  console.log('2. Type a known test password (like: Test123)');
  console.log('3. Press ENTER here');
  console.log('4. We will try to extract the encrypted value using different methods');
  console.log('');

  await new Promise(resolve => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    readline.question('Press ENTER after typing test password: ', () => {
      readline.close();
      resolve();
    });
  });

  console.log('');
  console.log('🔐 Attempting to extract encrypted value...');

  const extractionAttempts = await page.evaluate(() => {
    const attempts = {};

    // Attempt 1: Direct field value
    attempts.directValue = document.querySelector('input[name="pwd__E2E__"]')?.value || null;

    // Attempt 2: jQuery data
    if (window.jQuery || window.$) {
      const $ = window.jQuery || window.$;
      attempts.jqueryData = $('#pwd').data('encrypted') ||
                           $('#pwd').data('e2e') ||
                           $('#pwd').data('secure-value') ||
                           null;

      // Attempt 3: Call keypad method
      try {
        const keypad = $('#pwd').data('keypad');
        if (keypad) {
          attempts.keypadGetValue = keypad.getValue ? keypad.getValue() : null;
          attempts.keypadGetEncrypted = keypad.getEncrypted ? keypad.getEncrypted() : null;
          attempts.keypadGetE2E = keypad.getE2E ? keypad.getE2E() : null;
        }
      } catch (e) {
        attempts.keypadError = e.message;
      }
    }

    // Attempt 4: Check window variables
    attempts.windowE2E = window.E2E_ENCRYPTED_VALUE || window.encryptedPassword || null;

    return attempts;
  });

  console.log('');
  console.log('📊 EXTRACTION ATTEMPTS:');
  Object.entries(extractionAttempts).forEach(([method, value]) => {
    if (value) {
      console.log(`✅ ${method}:`);
      console.log(`   ${typeof value === 'string' ? value.substring(0, 60) : JSON.stringify(value)}`);
    } else {
      console.log(`❌ ${method}: null`);
    }
  });

  console.log('');
  console.log('═'.repeat(70));
  console.log('💡 SUMMARY & RECOMMENDATIONS:');
  console.log('═'.repeat(70));
  console.log('');

  if (extractionAttempts.directValue) {
    console.log('✅ GOOD NEWS: We can read pwd__E2E__ field directly!');
    console.log('');
    console.log('🎯 NEXT STEP: Find what SETS this value');
    console.log('   We need to trigger the same function that sets it when you type');
    console.log('');
    console.log('   Likely candidates:');
    console.log('   - $.fn.keypad() - The jQuery plugin');
    console.log('   - window.npKeyPadMaker() - The keypad maker function');
    console.log('   - An event listener on keydown/keyup');
    console.log('');
  } else {
    console.log('⚠️  Cannot read pwd__E2E__ field after typing');
    console.log('   This might mean:');
    console.log('   - Field is set only on form submit');
    console.log('   - Need to trigger specific method first');
    console.log('');
  }

  console.log('🔧 RECOMMENDED ACTIONS:');
  console.log('1. Search page source for "pwd__E2E__" to find where it\'s set');
  console.log('2. Look for jQuery keypad initialization code');
  console.log('3. Check form submit handler (where encryption likely happens)');
  console.log('4. Try: $("#pwd").keypad("getE2E") or similar methods');
  console.log('');

  console.log('Browser open for manual testing (60s)...');
  console.log('Try these in console:');
  console.log('  $("#pwd").data("keypad")');
  console.log('  $("#pwd").keypad("getEncrypted")');
  console.log('  window.npKeyPadMaker');
  console.log('');

  await page.waitForTimeout(60000);
  await browser.close();
}

exploreKeypadAPI().catch(console.error);
