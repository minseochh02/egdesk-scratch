/**
 * Direct Injection Test
 *
 * We know:
 * 1. pwd field shows masked pattern: "aaaa111a"
 * 2. pwd__E2E__ field has encrypted password
 * 3. We can set values directly!
 *
 * Let's try setting both and see if login works!
 */

const { chromium } = require('playwright-core');

async function testDirectInjection() {
  console.log('🧪 Direct Injection Test');
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

  console.log('');
  console.log('═'.repeat(70));
  console.log('EXPERIMENT 1: Capture Real Encrypted Values');
  console.log('═'.repeat(70));
  console.log('');
  console.log('INSTRUCTIONS:');
  console.log('1. Type your REAL password in the password field');
  console.log('2. Press ENTER here (DO NOT submit the form yet!)');
  console.log('3. We will capture the encrypted values');
  console.log('');

  await new Promise(resolve => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    readline.question('Press ENTER after typing password: ', () => {
      readline.close();
      resolve();
    });
  });

  // Capture all hidden field values
  const capturedValues = await page.evaluate(() => {
    const hiddenFields = {};
    document.querySelectorAll('input[type="hidden"]').forEach(field => {
      if (field.name && field.value) {
        hiddenFields[field.name] = field.value;
      }
    });

    return {
      visiblePassword: document.getElementById('pwd').value,
      hiddenFields,
      pwdE2E: document.querySelector('input[name="pwd__E2E__"]')?.value || null
    };
  });

  console.log('');
  console.log('✅ CAPTURED VALUES:');
  console.log('');
  console.log('Visible field (masked):', capturedValues.visiblePassword);
  console.log('');
  console.log('Hidden field pwd__E2E__:', capturedValues.pwdE2E);
  console.log('');
  console.log('Other hidden fields:');
  Object.entries(capturedValues.hiddenFields).forEach(([name, value]) => {
    if (name.includes('E2E') || name.includes('__K')) {
      console.log(`  ${name}: ${value.substring(0, 50)}...`);
    }
  });

  console.log('');
  console.log('═'.repeat(70));
  console.log('EXPERIMENT 2: Clear and Re-Inject Values');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Now we will:');
  console.log('1. Clear the form');
  console.log('2. Re-inject the captured values');
  console.log('3. See if the form still works');
  console.log('');

  await page.waitForTimeout(2000);

  // Clear form
  await page.evaluate(() => {
    document.getElementById('pwd').value = '';
    const pwdE2E = document.querySelector('input[name="pwd__E2E__"]');
    if (pwdE2E) pwdE2E.value = '';
  });

  console.log('✅ Form cleared');
  await page.waitForTimeout(1000);

  // Re-inject values
  const injectionSuccess = await page.evaluate((values) => {
    try {
      // Set visible masked pattern
      const pwdField = document.getElementById('pwd');
      pwdField.value = values.visiblePassword;
      pwdField.dispatchEvent(new Event('input', { bubbles: true }));
      pwdField.dispatchEvent(new Event('change', { bubbles: true }));

      // Set encrypted value
      const pwdE2E = document.querySelector('input[name="pwd__E2E__"]');
      if (pwdE2E && values.pwdE2E) {
        pwdE2E.value = values.pwdE2E;
      }

      // Re-set other E2E fields
      for (const [name, value] of Object.entries(values.hiddenFields)) {
        const field = document.querySelector(`input[name="${name}"]`);
        if (field) {
          field.value = value;
        }
      }

      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, capturedValues);

  console.log('');
  console.log('Injection result:', injectionSuccess ? '✅ SUCCESS' : '❌ FAILED');
  console.log('');

  // Verify
  const afterInjection = await page.evaluate(() => {
    return {
      visible: document.getElementById('pwd').value,
      pwdE2E: document.querySelector('input[name="pwd__E2E__"]')?.value || null
    };
  });

  console.log('After injection:');
  console.log('  Visible:', afterInjection.visible);
  console.log('  pwd__E2E__:', afterInjection.pwdE2E?.substring(0, 50) + '...');
  console.log('');

  console.log('═'.repeat(70));
  console.log('🎯 FINAL TEST: Try to Login');
  console.log('═'.repeat(70));
  console.log('');
  console.log('The form is now filled with the injected values.');
  console.log('');
  console.log('OPTIONS:');
  console.log('  A) Try clicking LOGIN button to see if it works');
  console.log('  B) Type Ctrl+C to stop and analyze');
  console.log('');
  console.log('Browser will stay open for 60 seconds...');
  console.log('');

  await page.waitForTimeout(60000);
  await browser.close();

  console.log('');
  console.log('═'.repeat(70));
  console.log('💡 INTERPRETATION:');
  console.log('═'.repeat(70));
  console.log('');
  console.log('If injection worked and form looks normal:');
  console.log('  ✅ We can bypass the security keyboard!');
  console.log('  ✅ Just need to find the E2E encryption function');
  console.log('  ✅ Call it with our password');
  console.log('  ✅ Inject the results');
  console.log('');
  console.log('If injection failed or form looks broken:');
  console.log('  ⚠️  May need to trigger keypad first');
  console.log('  ⚠️  May need to call specific initialization functions');
  console.log('  ⚠️  May need to match exact timing/sequence');
  console.log('');
}

testDirectInjection().catch(console.error);
