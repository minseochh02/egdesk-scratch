/**
 * Position-Based Encryption Test (MANUAL)
 *
 * Test: Does same character at same position produce same hash?
 *
 * Flow:
 * 1. Type "a"
 * 2. Press Enter to continue
 * 3. Type "b"
 * 4. Press Enter to continue
 * 5. Capture pwd__E2E__ (should have 2 hashes: hash_a1 + hash_b2)
 * 6. YOU manually backspace twice (clear field)
 * 7. Press Enter when cleared
 * 8. Type "a" again
 * 9. Press Enter to continue
 * 10. Type "b" again
 * 11. Press Enter to continue
 * 12. Capture pwd__E2E__ again
 * 13. Compare: Do we get same hashes?
 *
 * If YES (same hashes):
 *   ✅ Encryption is position-based (predictable!)
 *   ✅ We can replay individual keystrokes!
 *
 * If NO (different hashes):
 *   ❌ Includes timestamp/nonce (harder to defeat)
 */

const { chromium } = require('playwright-core');
const readline = require('readline');
const fs = require('fs');

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

async function getEncryptedFields(page) {
  return await page.evaluate(() => {
    const pwd = document.querySelector('#pwd');
    const visibleValue = pwd ? pwd.value : '';

    // Get all E2E fields
    const fields = {};
    document.querySelectorAll('input[type="hidden"]').forEach(input => {
      if (input.name && input.name.includes('E2E')) {
        fields[input.name] = input.value;
      }
    });

    return {
      visible: visibleValue,
      pwd__E2E__: fields['pwd__E2E__'] || '',
      __E2E_RESULT__: fields['__E2E_RESULT__'] || '',
      __E2E_UNIQUE__: fields['__E2E_UNIQUE__'] || '',
      allFields: fields
    };
  });
}

function splitIntoHashes(hexString) {
  // Each SHA-256 hash is 64 characters
  const hashes = [];
  for (let i = 0; i < hexString.length; i += 64) {
    hashes.push(hexString.substring(i, i + 64));
  }
  return hashes;
}

(async () => {
  console.log('🧪 Position-Based Encryption Test\n');
  console.log('═══════════════════════════════════════════════════════');

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

  console.log('\n📡 Navigating to login page...');
  await page.goto('https://www.shinhancard.com/pconts/html/member/login/MOBMLLOG002_02.html', {
    waitUntil: 'networkidle'
  });

  await page.waitForTimeout(3000);

  // Focus on password field
  console.log('🎯 Focusing on password field...');
  await page.locator('#pwd').click();
  await page.waitForTimeout(1000);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('ROUND 1: First attempt at typing "ab"');
  console.log('═══════════════════════════════════════════════════════');

  // Step 1: Type "a"
  await waitForEnter('Step 1: Now TYPE "a" in the password field (just press "a" key)');
  await page.waitForTimeout(500);

  const after_a1 = await getEncryptedFields(page);
  console.log(`\n✅ You typed something`);
  console.log(`   Visible: "${after_a1.visible}"`);
  console.log(`   pwd__E2E__ length: ${after_a1.pwd__E2E__.length} chars`);

  // Step 2: Type "b"
  await waitForEnter('Step 2: Now TYPE "b" in the password field (just press "b" key)');
  await page.waitForTimeout(500);

  const after_b1 = await getEncryptedFields(page);
  console.log(`\n✅ You typed something more`);
  console.log(`   Visible: "${after_b1.visible}"`);
  console.log(`   pwd__E2E__ length: ${after_b1.pwd__E2E__.length} chars`);

  // Split into individual hashes
  const round1_hashes = splitIntoHashes(after_b1.pwd__E2E__);
  console.log(`\n📊 Round 1 Hashes (${round1_hashes.length} total):`);
  round1_hashes.forEach((hash, idx) => {
    console.log(`   Hash ${idx + 1}: ${hash}`);
  });

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('MANUAL CLEAR: Delete both characters');
  console.log('═══════════════════════════════════════════════════════');

  await waitForEnter('Step 3: Now MANUALLY press BACKSPACE TWICE to clear the field completely');

  const after_clear = await getEncryptedFields(page);
  console.log(`\n📋 After clearing:`);
  console.log(`   Visible: "${after_clear.visible}"`);
  console.log(`   pwd__E2E__ length: ${after_clear.pwd__E2E__.length} chars`);
  console.log(`   (Encrypted field persists: ${after_clear.pwd__E2E__.length > 0 ? 'YES' : 'NO'})`);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('ROUND 2: Second attempt at typing "ab"');
  console.log('═══════════════════════════════════════════════════════');

  // Step 4: Type "a" again
  await waitForEnter('Step 4: Now TYPE "a" AGAIN in the password field (press "a" key)');
  await page.waitForTimeout(500);

  const after_a2 = await getEncryptedFields(page);
  console.log(`\n✅ You typed something (2nd time)`);
  console.log(`   Visible: "${after_a2.visible}"`);
  console.log(`   pwd__E2E__ length: ${after_a2.pwd__E2E__.length} chars`);

  // Step 5: Type "b" again
  await waitForEnter('Step 5: Now TYPE "b" AGAIN in the password field (press "b" key)');
  await page.waitForTimeout(500);

  const after_b2 = await getEncryptedFields(page);
  console.log(`\n✅ You typed something more (2nd time)`);
  console.log(`   Visible: "${after_b2.visible}"`);
  console.log(`   pwd__E2E__ length: ${after_b2.pwd__E2E__.length} chars`);

  // Split into individual hashes
  const round2_hashes = splitIntoHashes(after_b2.pwd__E2E__);
  console.log(`\n📊 Round 2 Hashes (${round2_hashes.length} total):`);
  round2_hashes.forEach((hash, idx) => {
    console.log(`   Hash ${idx + 1}: ${hash}`);
  });

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🔬 ANALYSIS: Comparing Round 1 vs Round 2');
  console.log('═══════════════════════════════════════════════════════');

  console.log(`\nRound 1 total hashes: ${round1_hashes.length}`);
  console.log(`Round 2 total hashes: ${round2_hashes.length}`);

  // The important hashes are the LAST 2 in each round (for "a" and "b")
  const round1_last_two = round1_hashes.slice(-2);
  const round2_last_two = round2_hashes.slice(-2);

  console.log('\n📍 Comparing the LAST 2 hashes from each round:');
  console.log('   (These should be the hashes for "a" and "b")');

  console.log('\n   Round 1 - Last 2 hashes:');
  console.log(`      [1] ${round1_last_two[0] || 'N/A'}`);
  console.log(`      [2] ${round1_last_two[1] || 'N/A'}`);

  console.log('\n   Round 2 - Last 2 hashes:');
  console.log(`      [1] ${round2_last_two[0] || 'N/A'}`);
  console.log(`      [2] ${round2_last_two[1] || 'N/A'}`);

  const firstCharMatch = round1_last_two[0] === round2_last_two[0];
  const secondCharMatch = round1_last_two[1] === round2_last_two[1];

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🎯 VERDICT');
  console.log('═══════════════════════════════════════════════════════');

  console.log(`\nFirst 'a' match:  ${firstCharMatch ? '✅ YES' : '❌ NO'}`);
  console.log(`Second 'b' match: ${secondCharMatch ? '✅ YES' : '❌ NO'}`);

  if (firstCharMatch && secondCharMatch) {
    console.log('\n🎉 CRITICAL FINDING: Position-based encryption!');
    console.log('   Same character at same position = SAME HASH');
    console.log('   This means:');
    console.log('   ✅ Hashes are PREDICTABLE within a session');
    console.log('   ✅ We can potentially REPLAY keystrokes');
    console.log('   ✅ Encryption does NOT include per-keystroke timestamp');
    console.log('   ✅ Only needs: session_key + char + position');
  } else {
    console.log('\n⚠️  FINDING: Dynamic per-keystroke encryption');
    console.log('   Same character at same position = DIFFERENT HASH');
    console.log('   This means:');
    console.log('   ❌ Includes timestamp/nonce/random per keystroke');
    console.log('   ❌ Cannot replay even within same session');
    console.log('   ❌ Each keystroke generates unique hash');
  }

  // Full data dump
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📋 FULL DATA DUMP');
  console.log('═══════════════════════════════════════════════════════');

  const results = {
    round1: {
      visible: after_b1.visible,
      pwd__E2E__: after_b1.pwd__E2E__,
      hashes: round1_hashes,
      __E2E_UNIQUE__: after_b1.__E2E_UNIQUE__
    },
    round2: {
      visible: after_b2.visible,
      pwd__E2E__: after_b2.pwd__E2E__,
      hashes: round2_hashes,
      __E2E_UNIQUE__: after_b2.__E2E_UNIQUE__
    },
    comparison: {
      firstCharMatch,
      secondCharMatch,
      sameSession: after_b1.__E2E_UNIQUE__ === after_b2.__E2E_UNIQUE__
    }
  };

  console.log(JSON.stringify(results, null, 2));

  // Save to file
  fs.writeFileSync('position-based-test-results.json', JSON.stringify(results, null, 2));
  console.log('\n💾 Saved to: position-based-test-results.json');

  await waitForEnter('\nTest complete! Press ENTER to close browser');

  await browser.close();
  rl.close();

  process.exit(0);
})();
