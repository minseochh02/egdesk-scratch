/**
 * Test: Garbled Hash Injection
 *
 * Goal: See what happens when we submit a modified/garbled hash
 *
 * This reveals:
 * - Does server validate hash format?
 * - Does server decrypt the hash?
 * - What error do we get (invalid format vs wrong password)?
 *
 * Method:
 * 1. Type real password to get valid pwd__E2E__
 * 2. Capture the hash
 * 3. Modify it (garble one hash)
 * 4. Inject modified value
 * 5. Submit and see error response
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
  console.log('🔬 Garbled Hash Injection Test\n');
  console.log('═'.repeat(70));
  console.log('Goal: Understand hash validation by sending garbled data');
  console.log('═'.repeat(70));
  console.log('');

  const results = {
    validHash: null,
    garbledHash: null,
    validResponse: null,
    garbledResponse: null
  };

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({ locale: 'ko-KR' });
  const page = await context.newPage();

  // Capture responses
  let responseCapture = null;

  page.on('response', async response => {
    const url = response.url();

    if (url.includes('CMMServiceMemLoginC.ajax') && response.request().method() === 'POST') {
      try {
        const responseText = await response.text();
        responseCapture = {
          status: response.status(),
          statusText: response.statusText(),
          body: responseText
        };

        console.log(`\n📥 Login response received:`);
        console.log(`   Status: ${response.status()}`);
        console.log(`   Body: ${responseText.substring(0, 200)}`);
        console.log('');
      } catch (e) {
        console.log(`   (Could not read response)`);
      }
    }
  });

  console.log('🌐 Loading page...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  console.log('═'.repeat(70));
  console.log('STEP 1: Type real password to get valid hash');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Instructions:');
  console.log('  1. Enter ID: testuser');
  console.log('  2. Type password with HARDWARE KEYBOARD: test');
  console.log('  3. Press ENTER here (don\'t click login yet!)');
  console.log('');

  await waitForEnter('Press ENTER after typing password');

  const validData = await page.evaluate(() => {
    return {
      visible: document.getElementById('pwd')?.value || '',
      pwd__E2E__: document.querySelector('input[name="pwd__E2E__"]')?.value || '',
      sessionID: document.querySelector('input[name="__E2E_UNIQUE__"]')?.value || ''
    };
  });

  console.log(`Captured valid data:`);
  console.log(`  Visible: "${validData.visible}"`);
  console.log(`  pwd__E2E__: ${validData.pwd__E2E__.substring(0, 60)}...`);
  console.log(`  Length: ${validData.pwd__E2E__.length} chars`);
  console.log('');

  results.validHash = validData.pwd__E2E__;

  // Create garbled version (modify the last hash)
  const hashes = [];
  for (let i = 0; i < validData.pwd__E2E__.length; i += 64) {
    hashes.push(validData.pwd__E2E__.substring(i, i + 64));
  }

  console.log(`Split into ${hashes.length} hashes`);
  console.log('');

  // Garble the last hash (change a few characters)
  const lastHashIndex = hashes.length - 1;
  const originalLastHash = hashes[lastHashIndex];
  const garbledLastHash = originalLastHash.substring(0, 50) + 'deadbeef' + originalLastHash.substring(58);

  hashes[lastHashIndex] = garbledLastHash;

  const garbledPwdE2E = hashes.join('');

  console.log('Created garbled hash:');
  console.log(`  Original last hash: ${originalLastHash}`);
  console.log(`  Garbled last hash:  ${garbledLastHash}`);
  console.log(`                         ↑ changed to "deadbeef"`);
  console.log('');

  results.garbledHash = garbledPwdE2E;

  console.log('═'.repeat(70));
  console.log('STEP 2: Inject garbled hash');
  console.log('═'.repeat(70));
  console.log('');

  console.log('Injecting garbled pwd__E2E__ AND visible password...');

  await page.evaluate(({ garbledValue, visiblePwd }) => {
    // Set visible password field (masked)
    document.getElementById('pwd').value = visiblePwd;

    // Set hidden pwd__E2E__ field (garbled hash)
    document.querySelector('input[name="pwd__E2E__"]').value = garbledValue;
  }, { garbledValue: garbledPwdE2E, visiblePwd: validData.visible });

  console.log(`✅ Injected:`);
  console.log(`   Visible field: "${validData.visible}"`);
  console.log(`   pwd__E2E__: ${garbledPwdE2E.substring(0, 60)}... (garbled)`);
  console.log('');

  console.log('═'.repeat(70));
  console.log('STEP 3: Submit login with garbled hash');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Click the LOGIN button now and watch the response!');
  console.log('');

  await waitForEnter('Press ENTER after clicking login');

  await page.waitForTimeout(2000);

  results.garbledResponse = responseCapture;

  console.log('');
  console.log('═'.repeat(70));
  console.log('📊 ANALYSIS');
  console.log('═'.repeat(70));
  console.log('');

  if (responseCapture) {
    console.log('Server response to garbled hash:');
    console.log(`  Status: ${responseCapture.status}`);
    console.log(`  Body: ${responseCapture.body.substring(0, 300)}`);
    console.log('');

    // Parse response if JSON
    try {
      const json = JSON.parse(responseCapture.body);

      console.log('Response details:');
      console.log(`  Result: ${json.crp_result || '(unknown)'}`);
      console.log(`  Code: ${json.crp_code || '(unknown)'}`);
      console.log(`  Message: ${json.crp_message || '(unknown)'}`);
      console.log('');

      if (json.crp_message?.includes('정보') || json.crp_message?.includes('존재')) {
        console.log('💡 Error type: "Invalid credentials" or "User not found"');
        console.log('   → Server processed the hash but password didn\'t match');
        console.log('   → This means server CAN decrypt/process garbled hashes!');
        console.log('   → Hash validation happens after decryption');
      } else if (json.crp_message?.includes('오류') || json.crp_message?.includes('error')) {
        console.log('💡 Error type: Generic error');
        console.log('   → Server might have detected invalid format');
        console.log('   → Or decryption failed');
      }
    } catch (e) {
      console.log('Response is not JSON, raw response above');
    }

    console.log('');
  } else {
    console.log('⚠️  No response captured');
  }

  console.log('═'.repeat(70));
  console.log('🎯 CONCLUSION');
  console.log('═'.repeat(70));
  console.log('');

  console.log('By testing garbled hash, we can learn:');
  console.log('  1. If error is "invalid format" → Hash format is validated');
  console.log('  2. If error is "wrong password" → Hash was decrypted successfully');
  console.log('  3. If error is "auth failed" → Server processed it somehow');
  console.log('  4. If server crashes → Hash might not have integrity checking');
  console.log('');

  // Save results
  fs.writeFileSync('garbled-hash-test.json', JSON.stringify(results, null, 2));
  console.log('💾 Saved to: garbled-hash-test.json');
  console.log('');

  await waitForEnter('Press ENTER to close browser');

  await browser.close();
  rl.close();

  process.exit(0);
})();
