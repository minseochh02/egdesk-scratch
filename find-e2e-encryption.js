/**
 * E2E Encryption Function Hunter
 *
 * We found these encrypted fields:
 * - pwd__E2E__
 * - __E2E_RESULT__
 * - __E2E_KEYPAD__
 *
 * Now we need to find the JavaScript function that creates these values!
 */

const { chromium } = require('playwright-core');
const fs = require('fs');

async function findE2EEncryption() {
  console.log('🔍 E2E Encryption Function Hunter');
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

  console.log('📍 Navigating to Shinhan Card...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  console.log('🔎 Searching for E2E encryption functions...');
  console.log('');

  const findings = await page.evaluate(() => {
    const results = {
      e2eFunctions: [],
      keypadFunctions: [],
      encryptFunctions: [],
      globalE2EObjects: [],
      suspiciousObjects: []
    };

    // 1. Search for E2E-related functions
    for (let key in window) {
      const keyLower = key.toLowerCase();

      // E2E functions
      if (keyLower.includes('e2e')) {
        if (typeof window[key] === 'function') {
          results.e2eFunctions.push({
            name: key,
            signature: window[key].toString().substring(0, 300)
          });
        } else if (typeof window[key] === 'object' && window[key]) {
          results.globalE2EObjects.push({
            name: key,
            properties: Object.keys(window[key]).slice(0, 20)
          });
        }
      }

      // Keypad functions
      if (keyLower.includes('keypad') || keyLower.includes('keyboard')) {
        if (typeof window[key] === 'function') {
          results.keypadFunctions.push({
            name: key,
            signature: window[key].toString().substring(0, 300)
          });
        } else if (typeof window[key] === 'object' && window[key]) {
          results.suspiciousObjects.push({
            name: key,
            properties: Object.keys(window[key]).slice(0, 20)
          });
        }
      }

      // Encrypt functions
      if (keyLower.includes('encrypt') || keyLower.includes('encode') || keyLower.includes('crypto')) {
        if (typeof window[key] === 'function') {
          results.encryptFunctions.push({
            name: key,
            signature: window[key].toString().substring(0, 300)
          });
        }
      }
    }

    // 2. Check jQuery plugins (if jQuery exists)
    if (window.jQuery || window.$) {
      const $ = window.jQuery || window.$;

      // Check for keypad plugin
      if ($.fn && $.fn.keypad) {
        results.suspiciousObjects.push({
          name: '$.fn.keypad',
          properties: Object.keys($.fn.keypad)
        });
      }

      if ($.fn && $.fn.e2e) {
        results.suspiciousObjects.push({
          name: '$.fn.e2e',
          properties: Object.keys($.fn.e2e)
        });
      }
    }

    // 3. Check password field for attached functions
    const pwdField = document.getElementById('pwd');
    if (pwdField) {
      for (let key in pwdField) {
        if (typeof pwdField[key] === 'function' &&
            !key.startsWith('_') &&
            key.length > 3) {
          const keyLower = key.toLowerCase();
          if (keyLower.includes('encrypt') ||
              keyLower.includes('e2e') ||
              keyLower.includes('keypad')) {
            results.suspiciousObjects.push({
              name: `#pwd.${key}`,
              type: 'field method'
            });
          }
        }
      }
    }

    return results;
  });

  console.log('📊 SEARCH RESULTS:');
  console.log('═'.repeat(70));
  console.log('');

  // Print E2E functions
  if (findings.e2eFunctions.length > 0) {
    console.log('🎯 FOUND E2E FUNCTIONS:');
    findings.e2eFunctions.forEach(f => {
      console.log(`   window.${f.name}()`);
      console.log(`   Signature: ${f.signature.substring(0, 150)}...`);
      console.log('');
    });
  } else {
    console.log('❌ No E2E functions found in window');
    console.log('');
  }

  // Print E2E objects
  if (findings.globalE2EObjects.length > 0) {
    console.log('🎯 FOUND E2E OBJECTS:');
    findings.globalE2EObjects.forEach(obj => {
      console.log(`   window.${obj.name}`);
      console.log(`   Properties: ${obj.properties.join(', ')}`);
      console.log('');
    });
  }

  // Print keypad functions
  if (findings.keypadFunctions.length > 0) {
    console.log('🎯 FOUND KEYPAD FUNCTIONS:');
    findings.keypadFunctions.forEach(f => {
      console.log(`   window.${f.name}()`);
      console.log(`   Signature: ${f.signature.substring(0, 150)}...`);
      console.log('');
    });
  }

  // Print suspicious objects
  if (findings.suspiciousObjects.length > 0) {
    console.log('🔍 SUSPICIOUS OBJECTS:');
    findings.suspiciousObjects.forEach(obj => {
      console.log(`   ${obj.name}`);
      if (obj.properties) {
        console.log(`   Properties: ${obj.properties.join(', ')}`);
      }
      console.log('');
    });
  }

  // Print encrypt functions
  if (findings.encryptFunctions.length > 0) {
    console.log('🔐 ENCRYPTION FUNCTIONS:');
    findings.encryptFunctions.forEach(f => {
      console.log(`   window.${f.name}()`);
      console.log('');
    });
  }

  console.log('═'.repeat(70));
  console.log('🧪 TESTING: Triggering keypad to see what loads...');
  console.log('═'.repeat(70));
  console.log('');

  // Click password field to trigger keypad
  await page.locator('[id="pwd"]').click();
  await page.waitForTimeout(3000);

  // Search again after keypad loads
  const afterKeypad = await page.evaluate(() => {
    const newFindings = {
      newE2EFunctions: [],
      newKeypadObjects: [],
      iframes: []
    };

    // Check for new functions
    for (let key in window) {
      const keyLower = key.toLowerCase();
      if ((keyLower.includes('e2e') || keyLower.includes('keypad')) &&
          typeof window[key] !== 'undefined') {
        if (typeof window[key] === 'function') {
          newFindings.newE2EFunctions.push(key);
        } else if (typeof window[key] === 'object' && window[key]) {
          newFindings.newKeypadObjects.push({
            name: key,
            properties: Object.keys(window[key]).slice(0, 10)
          });
        }
      }
    }

    // Check for keypad iframes
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      if (iframe.src || iframe.id) {
        newFindings.iframes.push({
          id: iframe.id,
          src: iframe.src,
          visible: iframe.offsetParent !== null
        });
      }
    });

    return newFindings;
  });

  console.log('📊 AFTER CLICKING PASSWORD FIELD:');
  console.log('');

  if (afterKeypad.newE2EFunctions.length > 0) {
    console.log('🎯 NEW FUNCTIONS APPEARED:');
    afterKeypad.newE2EFunctions.forEach(name => {
      console.log(`   window.${name}()`);
    });
    console.log('');
  }

  if (afterKeypad.newKeypadObjects.length > 0) {
    console.log('🎯 NEW KEYPAD OBJECTS:');
    afterKeypad.newKeypadObjects.forEach(obj => {
      console.log(`   window.${obj.name}`);
      console.log(`   Properties: ${obj.properties.join(', ')}`);
      console.log('');
    });
  }

  if (afterKeypad.iframes.length > 0) {
    console.log('📦 IFRAMES (keypad might be here):');
    afterKeypad.iframes.forEach(iframe => {
      console.log(`   ID: ${iframe.id || '(no id)'}`);
      console.log(`   Src: ${iframe.src || '(no src)'}`);
      console.log(`   Visible: ${iframe.visible}`);
      console.log('');
    });
  }

  console.log('═'.repeat(70));
  console.log('💡 NEXT STEPS:');
  console.log('═'.repeat(70));
  console.log('');
  console.log('1. Try calling the functions found above with test password');
  console.log('2. Monitor what happens to pwd__E2E__ field when you type');
  console.log('3. Check iframe communication if keypad is in iframe');
  console.log('4. Look for Form submission handler that sets encrypted fields');
  console.log('');
  console.log('🧪 TYPE A PASSWORD NOW and watch the hidden fields change!');
  console.log('   Then share the updated hidden field values');
  console.log('');

  await page.waitForTimeout(60000);
  await browser.close();
}

findE2EEncryption().catch(console.error);
