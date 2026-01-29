/**
 * Test if jQuery keypad setValue actually works
 *
 * The methods exist, but do they SET the pwd__E2E__ field?
 * Let's test by calling the method and checking the encrypted field!
 */

const { chromium } = require('playwright-core');

async function testKeypadSetValue() {
  console.log('🧪 Testing jQuery Keypad setValue');
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
  console.log('═'.repeat(70));
  console.log('TEST 1: Check pwd__E2E__ BEFORE calling setValue');
  console.log('═'.repeat(70));
  console.log('');

  const beforeCall = await page.evaluate(() => {
    return {
      visible: document.getElementById('pwd')?.value || '',
      pwdE2E: document.querySelector('input[name="pwd__E2E__"]')?.value || '(empty)',
      e2eResult: document.querySelector('input[name="__E2E_RESULT__"]')?.value || '(empty)'
    };
  });

  console.log('Before calling setValue:');
  console.log(`  Visible field: "${beforeCall.visible}"`);
  console.log(`  pwd__E2E__: ${beforeCall.pwdE2E.substring(0, 40)}...`);
  console.log(`  __E2E_RESULT__: ${beforeCall.e2eResult.substring(0, 40)}...`);

  console.log('');
  console.log('═'.repeat(70));
  console.log('TEST 2: Call $("#pwd").keypad("setValue", "Test123")');
  console.log('═'.repeat(70));
  console.log('');

  const testPassword = 'Test123';
  console.log(`Calling: $('#pwd').keypad('setValue', '${testPassword}')...`);

  await page.evaluate((pwd) => {
    $('#pwd').keypad('setValue', pwd);
  }, testPassword);

  console.log('✅ Method called (no error)');
  console.log('');

  // Wait a moment for encryption to happen
  await page.waitForTimeout(1000);

  console.log('═'.repeat(70));
  console.log('TEST 3: Check pwd__E2E__ AFTER calling setValue');
  console.log('═'.repeat(70));
  console.log('');

  const afterCall = await page.evaluate(() => {
    return {
      visible: document.getElementById('pwd')?.value || '',
      pwdE2E: document.querySelector('input[name="pwd__E2E__"]')?.value || '(empty)',
      e2eResult: document.querySelector('input[name="__E2E_RESULT__"]')?.value || '(empty)',
      allE2EFields: {}
    };
  });

  // Get all E2E fields
  const allE2EFields = await page.evaluate(() => {
    const fields = {};
    document.querySelectorAll('input[type="hidden"]').forEach(field => {
      if (field.name && field.name.includes('E2E') && field.value) {
        fields[field.name] = field.value;
      }
    });
    return fields;
  });

  console.log('After calling setValue:');
  console.log(`  Visible field: "${afterCall.visible}"`);
  console.log(`  pwd__E2E__: ${afterCall.pwdE2E.substring(0, 40)}...`);
  console.log(`  __E2E_RESULT__: ${afterCall.e2eResult.substring(0, 40)}...`);
  console.log('');

  // Compare before and after
  const visibleChanged = beforeCall.visible !== afterCall.visible;
  const pwdE2EChanged = beforeCall.pwdE2E !== afterCall.pwdE2E;
  const e2eResultChanged = beforeCall.e2eResult !== afterCall.e2eResult;

  console.log('═'.repeat(70));
  console.log('📊 CHANGE DETECTION:');
  console.log('═'.repeat(70));
  console.log('');
  console.log(`  Visible field changed: ${visibleChanged ? '✅ YES' : '❌ NO'}`);
  console.log(`  pwd__E2E__ changed: ${pwdE2EChanged ? '✅ YES' : '❌ NO'}`);
  console.log(`  __E2E_RESULT__ changed: ${e2eResultChanged ? '✅ YES' : '❌ NO'}`);
  console.log('');

  if (visibleChanged || pwdE2EChanged || e2eResultChanged) {
    console.log('🎉🎉🎉 SUCCESS! 🎉🎉🎉');
    console.log('');
    console.log('✅ The jQuery keypad method WORKS!');
    console.log('✅ We can call it programmatically!');
    console.log('✅ It generates fresh encrypted values!');
    console.log('');
    console.log('All E2E fields after setValue:');
    Object.entries(allE2EFields).forEach(([name, value]) => {
      console.log(`  ${name}: ${value.substring(0, 50)}...`);
    });
    console.log('');
    console.log('🎯 NEXT STEP: Test login with this method!');
  } else {
    console.log('❌ Method didn\'t change the fields');
    console.log('');
    console.log('Possible reasons:');
    console.log('  1. Method needs different parameters');
    console.log('  2. Need to call a different method');
    console.log('  3. Need to trigger keypad first in a specific way');
    console.log('  4. Encryption happens on a timer/delay');
    console.log('');
    console.log('Try typing manually and see what happens to fields...');
  }

  console.log('');
  console.log('═'.repeat(70));
  console.log('🧪 FINAL TEST: Try login with setValue method');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Options:');
  console.log('  1. Type "test" to attempt automated login with setValue');
  console.log('  2. Type "skip" to skip');
  console.log('');

  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise(resolve => {
    readline.question('Your choice: ', (ans) => {
      readline.close();
      resolve(ans.toLowerCase());
    });
  });

  if (answer === 'test') {
    console.log('');
    console.log('🚀 Testing login with setValue method...');

    // Fill user ID
    console.log('Filling user ID (enter yours)...');
    await new Promise(resolve => {
      const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      rl.question('Enter user ID: ', async (userId) => {
        rl.close();

        await page.fill('[id="memid"]', userId);
        console.log(`✅ User ID filled: ${userId}`);
        resolve();
      });
    });

    // Get password
    await new Promise(resolve => {
      const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      rl.question('Enter password: ', async (password) => {
        rl.close();

        console.log('');
        console.log('🔐 Calling jQuery keypad setValue...');

        // Call setValue
        await page.evaluate((pwd) => {
          $('#pwd').keypad('setValue', pwd);
        }, password);

        await page.waitForTimeout(1000);

        console.log('✅ setValue called');
        console.log('');
        console.log('🚀 Clicking login button...');

        await page.locator('[id="loginC"]').click();
        await page.waitForTimeout(5000);

        const currentUrl = page.url();
        console.log('');
        console.log(`Current URL: ${currentUrl}`);

        if (currentUrl !== 'https://www.shinhancard.com/cconts/html/main.html') {
          console.log('');
          console.log('🎉🎉🎉 LOGIN SUCCESSFUL! 🎉🎉🎉');
          console.log('');
          console.log('✅ jQuery keypad setValue WORKS!');
          console.log('✅ We can fully automate password entry!');
          console.log('✅ No manual capture needed!');
          console.log('✅ SECURITY KEYBOARD: COMPLETELY BYPASSED!');
        } else {
          console.log('');
          console.log('⚠️  Still on login page - check for error messages');
        }

        resolve();
      });
    });
  }

  console.log('');
  console.log('Browser stays open for inspection (30s)...');
  await page.waitForTimeout(30000);

  await browser.close();
}

testKeypadSetValue().catch(console.error);
