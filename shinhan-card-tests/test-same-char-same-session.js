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
  console.log('STEP 1: Type "g" (position 1)');
  console.log('═'.repeat(70));
  console.log('');

  await waitForEnter('Type "g" with hardware keyboard, then press ENTER');

  const afterFirstG = await page.evaluate(() => {
    return {
      visible: document.getElementById('pwd')?.value || '',
      pwd__E2E__: document.querySelector('input[name="pwd__E2E__"]')?.value || ''
    };
  });

  console.log(`Visible: "${afterFirstG.visible}"`);
  console.log(`pwd__E2E__: ${afterFirstG.pwd__E2E__}`);
  console.log(`Length: ${afterFirstG.pwd__E2E__.length} chars`);
  console.log('');

  const hash_position1 = afterFirstG.pwd__E2E__;

  console.log('═'.repeat(70));
  console.log('STEP 2: Type "g" again (now "gg")');
  console.log('═'.repeat(70));
  console.log('');

  await waitForEnter('Type "g" AGAIN (don\'t delete), then press ENTER');

  const afterGG = await page.evaluate(() => {
    return {
      visible: document.getElementById('pwd')?.value || '',
      pwd__E2E__: document.querySelector('input[name="pwd__E2E__"]')?.value || ''
    };
  });

  console.log(`Visible: "${afterGG.visible}"`);
  console.log(`pwd__E2E__ length: ${afterGG.pwd__E2E__.length} chars`);
  console.log('');

  const fullGG = afterGG.pwd__E2E__;
  const hash_pos1_from_gg = fullGG.substring(0, 64);
  const hash_pos2_from_gg = fullGG.substring(64, 128);

  console.log('Extracted hashes:');
  console.log(`  Position 1: ${hash_pos1_from_gg}`);
  console.log(`  Position 2: ${hash_pos2_from_gg}`);
  console.log('');

  console.log('═'.repeat(70));
  console.log('STEP 3: Backspace (delete second "g")');
  console.log('═'.repeat(70));
  console.log('');

  await waitForEnter('Press BACKSPACE once, then press ENTER');

  const afterBackspace = await page.evaluate(() => {
    return {
      visible: document.getElementById('pwd')?.value || '',
      pwd__E2E__: document.querySelector('input[name="pwd__E2E__"]')?.value || ''
    };
  });

  console.log(`Visible: "${afterBackspace.visible}"`);
  console.log(`pwd__E2E__: ${afterBackspace.pwd__E2E__}`);
  console.log(`Length: ${afterBackspace.pwd__E2E__.length} chars`);
  console.log('');

  const hash_after_backspace = afterBackspace.pwd__E2E__;

  // Compare
  console.log('═'.repeat(70));
  console.log('🎯 CRITICAL COMPARISON');
  console.log('═'.repeat(70));
  console.log('');

  console.log('Session ID:', sessionData.sessionID, '(same session throughout)');
  console.log('');

  console.log('Hash for position 1 (step 1, typing "g"):');
  console.log(`  ${hash_position1}`);
  console.log('');

  console.log('Hash for position 1 (step 3, after backspace):');
  console.log(`  ${hash_after_backspace}`);
  console.log('');

  const match = hash_position1 === hash_after_backspace;

  console.log(`Match: ${match ? '✅ SAME' : '❌ DIFFERENT'}`);
  console.log('');

  // Bonus check: Did position 1 hash stay consistent in step 2?
  console.log('Bonus check - Position 1 hash in "gg" (step 2):');
  console.log(`  ${hash_pos1_from_gg}`);
  console.log(`  Same as step 1? ${hash_position1 === hash_pos1_from_gg ? '✅ YES' : '❌ NO'}`);
  console.log('');

  if (match) {
    console.log('🎉 POSITION-BASED HASHING!');
    console.log('');
    console.log('Same character at same position = SAME hash');
    console.log('');
    console.log('This means:');
    console.log('  ✅ Hash formula: SHA256(session_key + char + POSITION)');
    console.log('  ✅ Position determines hash (not timestamp!)');
    console.log('  ✅ We can PREDICT hashes if we know session keys!');
    console.log('  ✅ Typing/deleting/retyping at same position = same hash');
    console.log('');
    console.log('Exploitation potential:');
    console.log('  - Extract session keys from page');
    console.log('  - Calculate hash for each character at each position');
    console.log('  - Build pwd__E2E__ field manually');
    console.log('  - BYPASS hardware keyboard requirement!');
    console.log('');
  } else {
    console.log('🔴 TIMESTAMP/SEQUENCE-BASED HASHING!');
    console.log('');
    console.log('Same character at same position = DIFFERENT hash');
    console.log('');
    console.log('This confirms:');
    console.log('  ✅ Hash includes timestamp or sequence counter');
    console.log('  ✅ Each keystroke gets unique hash (even if deleted and retyped)');
    console.log('  ✅ Cannot predict hashes from position alone');
    console.log('  ✅ Backspace doesn\'t reset the hash generation');
    console.log('');
    console.log('This means:');
    console.log('  - Hash formula includes time-variant component');
    console.log('  - Likely: SHA256(key + char + position + timestamp/counter)');
    console.log('  - Timestamp data sent via WebSocket (to INCA localhost)');
    console.log('  - Server needs timestamp to recreate hash for verification');
    console.log('');
  }

  // Save results
  const results = {
    test: 'Position-Based Hash Test (g → gg → g)',
    sessionID: sessionData.sessionID,
    sessionTimestamp: date.toISOString(),
    character: 'g',
    step1_hash_position1: hash_position1,
    step2_hash_gg_position1: hash_pos1_from_gg,
    step2_hash_gg_position2: hash_pos2_from_gg,
    step3_hash_after_backspace: hash_after_backspace,
    comparison: {
      position1_before_vs_after: match,
      position1_step1_vs_step2: hash_position1 === hash_pos1_from_gg
    },
    conclusion: match ? 'Position-based (deterministic)' : 'Timestamp/sequence-based (non-deterministic)'
  };

  fs.writeFileSync('position-hash-test.json', JSON.stringify(results, null, 2));
  console.log('💾 Saved to: position-hash-test.json');
  console.log('');

  await waitForEnter('Press ENTER to close browser');

  await browser.close();
  rl.close();

  process.exit(0);
})();
