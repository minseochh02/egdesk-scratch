/**
 * Test: Same Character in Same Session
 *
 * Goal: Verify that typing same character twice gives different hashes
 *
 * Method:
 * 1. Type "g" with hardware keyboard
 * 2. Capture pwd__E2E__ hash
 * 3. Delete (backspace)
 * 4. Type "g" again
 * 5. Capture pwd__E2E__ hash again
 * 6. Compare
 *
 * Expected: Different hashes (includes timestamp)
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
  console.log('🔬 Same Character Same Session Test\n');
  console.log('═'.repeat(70));
  console.log('Testing: Does same char in same session = same hash?');
  console.log('═'.repeat(70));
  console.log('');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({ locale: 'ko-KR' });
  const page = await context.newPage();

  console.log('🌐 Loading page...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  // Get session ID
  const sessionData = await page.evaluate(() => {
    return {
      sessionID: document.querySelector('input[name="__E2E_UNIQUE__"]')?.value
    };
  });

  console.log(`Session ID: ${sessionData.sessionID}`);
  console.log('');

  // Parse session ID
  console.log('📊 Session ID Analysis:');
  const first13 = sessionData.sessionID.substring(0, 13);
  const last2 = sessionData.sessionID.substring(13);
  const timestamp = parseInt(first13);
  const date = new Date(timestamp);

  console.log(`  Full ID: ${sessionData.sessionID} (${sessionData.sessionID.length} digits)`);
  console.log(`  First 13 digits: ${first13}`);
  console.log(`  Last 2 digits: ${last2}`);
  console.log(`  As timestamp: ${date.toISOString()}`);
  console.log(`  Local time: ${date.toLocaleString()}`);
  console.log(`  Time since session start: ${Date.now() - timestamp}ms ago`);
  console.log('');

  if (date.getFullYear() === new Date().getFullYear() &&
      Math.abs(Date.now() - timestamp) < 60000) {
    console.log('  ✅ Verified: Session ID is recent timestamp + suffix');
  } else {
    console.log('  ⚠️  Session ID doesn\'t match expected timestamp format');
  }
  console.log('');

  console.log('═'.repeat(70));
  console.log('ROUND 1: Type "g"');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Instructions:');
  console.log('  1. Click on password field');
  console.log('  2. Type the letter "g" with your HARDWARE KEYBOARD');
  console.log('  3. Press ENTER here (do NOT delete yet)');
  console.log('');

  await waitForEnter('Press ENTER after typing "g"');

  const afterFirstG = await page.evaluate(() => {
    return {
      visible: document.getElementById('pwd')?.value || '',
      pwd__E2E__: document.querySelector('input[name="pwd__E2E__"]')?.value || ''
    };
  });

  console.log('After first "g":');
  console.log(`  Visible field: "${afterFirstG.visible}"`);
  console.log(`  pwd__E2E__: ${afterFirstG.pwd__E2E__}`);
  console.log(`  Length: ${afterFirstG.pwd__E2E__.length} chars`);
  console.log('');

  const hash1 = afterFirstG.pwd__E2E__;

  if (hash1.length !== 64) {
    console.log(`⚠️  Expected 64 chars for one character, got ${hash1.length}`);
    console.log('   You might have typed more than one character');
  }

  console.log('═'.repeat(70));
  console.log('DELETE: Remove "g"');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Instructions:');
  console.log('  1. Press BACKSPACE on your keyboard to delete "g"');
  console.log('  2. Verify password field is empty');
  console.log('  3. Press ENTER here');
  console.log('');

  await waitForEnter('Press ENTER after deleting');

  const afterDelete = await page.evaluate(() => {
    return {
      visible: document.getElementById('pwd')?.value || '',
      pwd__E2E__: document.querySelector('input[name="pwd__E2E__"]')?.value || ''
    };
  });

  console.log('After delete:');
  console.log(`  Visible field: "${afterDelete.visible}"`);
  console.log(`  pwd__E2E__: ${afterDelete.pwd__E2E__.length > 0 ? afterDelete.pwd__E2E__.substring(0, 60) + '...' : '(empty)'}`);
  console.log(`  Length: ${afterDelete.pwd__E2E__.length} chars`);
  console.log('');

  if (afterDelete.pwd__E2E__.length > 0) {
    console.log('⚠️  pwd__E2E__ not empty after delete!');
    console.log('   Manual backspace should have cleared it');
  }

  console.log('═'.repeat(70));
  console.log('ROUND 2: Type "g" again');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Instructions:');
  console.log('  1. Type the letter "g" with your HARDWARE KEYBOARD (same as before)');
  console.log('  2. Press ENTER here');
  console.log('');

  await waitForEnter('Press ENTER after typing "g" again');

  const afterSecondG = await page.evaluate(() => {
    return {
      visible: document.getElementById('pwd')?.value || '',
      pwd__E2E__: document.querySelector('input[name="pwd__E2E__"]')?.value || ''
    };
  });

  console.log('After second "g":');
  console.log(`  Visible field: "${afterSecondG.visible}"`);
  console.log(`  pwd__E2E__: ${afterSecondG.pwd__E2E__}`);
  console.log(`  Length: ${afterSecondG.pwd__E2E__.length} chars`);
  console.log('');

  const hash2 = afterSecondG.pwd__E2E__;

  // Compare
  console.log('═'.repeat(70));
  console.log('🎯 COMPARISON');
  console.log('═'.repeat(70));
  console.log('');

  console.log('Session ID:', sessionData.sessionID);
  console.log('Character typed: "g" (both times)');
  console.log('Position: 1st character (both times)');
  console.log('');

  console.log('Hash 1 (first "g"):');
  console.log(`  ${hash1}`);
  console.log('');

  console.log('Hash 2 (second "g"):');
  console.log(`  ${hash2}`);
  console.log('');

  const match = hash1 === hash2;

  console.log(`Match: ${match ? '✅ SAME' : '❌ DIFFERENT'}`);
  console.log('');

  if (match) {
    console.log('🤔 Unexpected Result:');
    console.log('');
    console.log('Same character, same session, same position = SAME hash');
    console.log('');
    console.log('This means:');
    console.log('  - Hash does NOT include timestamp/nonce');
    console.log('  - Hash formula: SHA256(session_key + char + position) only');
    console.log('  - We can PREDICT hashes!');
    console.log('  - Massive exploit opportunity!');
    console.log('');
  } else {
    console.log('✅ Expected Result:');
    console.log('');
    console.log('Same character, same session, same position = DIFFERENT hash');
    console.log('');
    console.log('This confirms:');
    console.log('  - Hash includes timestamp or nonce');
    console.log('  - Cannot predict hashes from session data alone');
    console.log('  - Timestamp must be sent somewhere (WebSocket or embedded)');
    console.log('');
    console.log('Evidence for timestamp in hash:');
    console.log('  ✅ Same char = different hash (proven again)');
    console.log('  ✅ Only pwd__E2E__ changes during typing (other fields static)');
    console.log('  ✅ Timestamp NOT in separate field');
    console.log('  → Conclusion: Timestamp embedded in pwd__E2E__ hashes');
    console.log('  → Server receives timestamp via WebSocket separately');
    console.log('');
  }

  // Save results
  const results = {
    test: 'Same Character Same Session',
    sessionID: sessionData.sessionID,
    character: 'g',
    hash1: hash1,
    hash2: hash2,
    match: match,
    conclusion: match ? 'Hashes are deterministic' : 'Hashes include timestamp/nonce'
  };

  fs.writeFileSync('same-char-hash-test.json', JSON.stringify(results, null, 2));
  console.log('💾 Saved to: same-char-hash-test.json');
  console.log('');

  await waitForEnter('Press ENTER to close browser');

  await browser.close();
  rl.close();

  process.exit(0);
})();
