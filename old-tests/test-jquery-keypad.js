/**
 * jQuery Keypad Plugin API Test
 *
 * We found $.fn.keypad() plugin exists.
 * This script will:
 * 1. Explore the plugin's methods
 * 2. Try to call encryption directly
 * 3. Test if we can set password programmatically
 */

const { chromium } = require('playwright-core');

async function testJQueryKeypad() {
  console.log('🎯 jQuery Keypad Plugin API Test');
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

  console.log('🎯 Activating keypad...');
  await page.locator('[id="pwd"]').click();
  await page.waitForTimeout(2000);

  console.log('');
  console.log('🔍 Exploring $.fn.keypad plugin...');
  console.log('');

  // Deep dive into keypad plugin
  const keypadInfo = await page.evaluate(() => {
    const info = {
      pluginExists: false,
      pluginSource: null,
      pluginMethods: [],
      passwordFieldKeypad: null,
      allKeypadMethods: []
    };

    if (window.jQuery || window.$) {
      const $ = window.jQuery || window.$;

      // Check plugin
      if ($.fn && $.fn.keypad) {
        info.pluginExists = true;
        info.pluginSource = $.fn.keypad.toString();

        // Get methods from plugin
        for (let key in $.fn.keypad) {
          info.pluginMethods.push({
            name: key,
            type: typeof $.fn.keypad[key],
            value: typeof $.fn.keypad[key] === 'function' ?
                   $.fn.keypad[key].toString().substring(0, 200) :
                   String($.fn.keypad[key]).substring(0, 100)
          });
        }
      }

      // Check keypad instance on password field
      const pwdKeypad = $('#pwd').data('keypad');
      if (pwdKeypad) {
        info.passwordFieldKeypad = {
          exists: true,
          type: typeof pwdKeypad,
          constructor: pwdKeypad.constructor?.name || 'unknown'
        };

        // Get all methods from instance
        for (let key in pwdKeypad) {
          if (typeof pwdKeypad[key] === 'function') {
            info.allKeypadMethods.push({
              name: key,
              params: pwdKeypad[key].length,
              source: pwdKeypad[key].toString().substring(0, 300)
            });
          }
        }
      }
    }

    return info;
  });

  if (keypadInfo.pluginExists) {
    console.log('✅ $.fn.keypad plugin EXISTS!');
    console.log('');
    console.log('Plugin source (first 500 chars):');
    console.log(keypadInfo.pluginSource.substring(0, 500));
    console.log('...');
    console.log('');

    if (keypadInfo.pluginMethods.length > 0) {
      console.log('Plugin static methods/properties:');
      keypadInfo.pluginMethods.forEach(m => {
        console.log(`  $.fn.keypad.${m.name} (${m.type})`);
        if (m.type === 'function') {
          console.log(`    ${m.value.substring(0, 150)}...`);
        }
      });
      console.log('');
    }
  }

  if (keypadInfo.passwordFieldKeypad) {
    console.log('🎯 KEYPAD INSTANCE on #pwd field:');
    console.log(`   Type: ${keypadInfo.passwordFieldKeypad.type}`);
    console.log(`   Constructor: ${keypadInfo.passwordFieldKeypad.constructor}`);
    console.log('');

    if (keypadInfo.allKeypadMethods.length > 0) {
      console.log('   Available methods on instance:');
      keypadInfo.allKeypadMethods.forEach(m => {
        console.log(`     instance.${m.name}(${m.params} params)`);
        console.log(`       ${m.source.substring(0, 200)}...`);
        console.log('');
      });
    }
  }

  console.log('═'.repeat(70));
  console.log('🧪 TESTING: Can we call keypad methods programmatically?');
  console.log('═'.repeat(70));
  console.log('');

  // Try various method calls
  const testPassword = 'Test123';

  const testCalls = [
    // Test 1: Call plugin as function
    { code: `$('#pwd').keypad()`, desc: 'Initialize keypad' },

    // Test 2: Try setValue variations
    { code: `$('#pwd').keypad('setValue', '${testPassword}')`, desc: 'Set value via plugin' },
    { code: `$('#pwd').keypad('setPassword', '${testPassword}')`, desc: 'Set password via plugin' },
    { code: `$('#pwd').keypad('encrypt', '${testPassword}')`, desc: 'Encrypt via plugin' },

    // Test 3: Try instance methods
    { code: `$('#pwd').data('keypad').setValue('${testPassword}')`, desc: 'Instance setValue' },
    { code: `$('#pwd').data('keypad').setPassword('${testPassword}')`, desc: 'Instance setPassword' },
    { code: `$('#pwd').data('keypad').encrypt('${testPassword}')`, desc: 'Instance encrypt' },

    // Test 4: Try to get encrypted value
    { code: `$('#pwd').keypad('getE2E')`, desc: 'Get E2E value' },
    { code: `$('#pwd').keypad('getEncrypted')`, desc: 'Get encrypted value' },
    { code: `$('#pwd').data('keypad').getE2E()`, desc: 'Instance getE2E' },
  ];

  for (const test of testCalls) {
    const result = await page.evaluate((testCode) => {
      try {
        const result = eval(testCode);
        return {
          success: true,
          type: typeof result,
          value: result,
          valuePreview: typeof result === 'string' ? result.substring(0, 60) :
                       typeof result === 'object' ? JSON.stringify(result).substring(0, 100) :
                       String(result)
        };
      } catch (e) {
        return {
          success: false,
          error: e.message
        };
      }
    }, test.code);

    console.log(`Testing: ${test.desc}`);
    console.log(`  Code: ${test.code}`);

    if (result.success) {
      console.log(`  ✅ SUCCESS!`);
      console.log(`  Type: ${result.type}`);
      console.log(`  Value: ${result.valuePreview}`);

      // Check if pwd__E2E__ field was updated
      const pwdE2E = await page.evaluate(() => {
        return document.querySelector('input[name="pwd__E2E__"]')?.value || null;
      });

      if (pwdE2E) {
        console.log(`  pwd__E2E__ field: ${pwdE2E.substring(0, 40)}...`);
        console.log(`  🎉 THIS METHOD MIGHT WORK! Test it further!`);
      }
    } else {
      console.log(`  ❌ Failed: ${result.error}`);
    }
    console.log('');
  }

  console.log('═'.repeat(70));
  console.log('💡 FINAL RECOMMENDATIONS:');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Based on tests above, the working method should be used in automation.');
  console.log('');
  console.log('Browser will stay open for inspection (60s)...');
  console.log('Try calling methods manually in console!');
  console.log('');

  await page.waitForTimeout(60000);
  await browser.close();
}

testJQueryKeypad().catch(console.error);
