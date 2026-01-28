/**
 * Same Character Multiple Times Test
 *
 * Test: Type "g", clear, type "g" again (in SAME session)
 *
 * This reveals:
 * - Is encryption per-keystroke? (different each time)
 * - Is encryption per-session? (same in one session)
 * - Does clearing visible field clear encrypted field?
 * - What changes between attempts?
 */

const { chromium } = require('playwright-core');
const fs = require('fs');

async function testSameCharMultipleTimes() {
  console.log('🔬 Same Character Multiple Times Test');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Test plan:');
  console.log('  1. Type "g" → Capture encrypted values');
  console.log('  2. Clear field → Check if encrypted values clear');
  console.log('  3. Type "g" again → Compare encrypted values');
  console.log('  4. Repeat 3 times total');
  console.log('');
  console.log('This reveals if encryption includes per-keystroke randomness');
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

  console.log('🎯 Focusing password field...');
  await page.locator('[id="pwd"]').click();
  await page.waitForTimeout(2000);

  const testResults = [];

  // Run 3 iterations
  for (let i = 1; i <= 3; i++) {
    console.log('');
    console.log('═'.repeat(70));
    console.log(`ITERATION ${i}/3`);
    console.log('═'.repeat(70));
    console.log('');

    // STEP 1: Type "g"
    console.log(`Step 1: Type "g"`);
    console.log('  → Type exactly "g" in the password field');
    console.log('  → Press ENTER here');
    console.log('');

    await new Promise(resolve => {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      readline.question('Press ENTER after typing "g": ', () => {
        readline.close();
        resolve();
      });
    });

    await page.waitForTimeout(1000);

    // Capture state after typing
    const afterTyping = await page.evaluate(() => {
      const fields = {};
      document.querySelectorAll('input[type="hidden"]').forEach(field => {
        if (field.name && field.value) {
          fields[field.name] = field.value;
        }
      });

      return {
        timestamp: Date.now(),
        visible: document.getElementById('pwd')?.value || '',
        pwd__E2E__: fields['pwd__E2E__'] || null,
        __E2E_RESULT__: fields['__E2E_RESULT__'] || null,
        __E2E_KEYPAD__: fields['__E2E_KEYPAD__'] || null,
        __KI_pwd: fields['__KI_pwd'] || null,
        __E2E_UNIQUE__: fields['__E2E_UNIQUE__'] || null,
        allFields: fields
      };
    });

    console.log('');
    console.log('  After typing "g":');
    console.log(`    Visible: "${afterTyping.visible}"`);
    console.log(`    pwd__E2E__: ${afterTyping.pwd__E2E__?.substring(0, 50)}...`);
    console.log('');

    testResults.push({
      iteration: i,
      action: 'after_typing',
      ...afterTyping
    });

    // STEP 2: Clear the field
    console.log(`Step 2: Clearing field...`);

    await page.evaluate(() => {
      document.getElementById('pwd').value = '';
      document.getElementById('pwd').dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('pwd').dispatchEvent(new Event('change', { bubbles: true }));
    });

    await page.waitForTimeout(1000);

    // Capture state after clearing
    const afterClearing = await page.evaluate(() => {
      const fields = {};
      document.querySelectorAll('input[type="hidden"]').forEach(field => {
        if (field.name && field.value) {
          fields[field.name] = field.value;
        }
      });

      return {
        timestamp: Date.now(),
        visible: document.getElementById('pwd')?.value || '',
        pwd__E2E__: fields['pwd__E2E__'] || null,
        __E2E_RESULT__: fields['__E2E_RESULT__'] || null,
        allFieldsCount: Object.keys(fields).length
      };
    });

    console.log('  After clearing:');
    console.log(`    Visible: "${afterClearing.visible}"`);
    console.log(`    pwd__E2E__: ${afterClearing.pwd__E2E__ ? afterClearing.pwd__E2E__.substring(0, 50) + '...' : '(empty)'}`);
    console.log('');

    testResults.push({
      iteration: i,
      action: 'after_clearing',
      ...afterClearing
    });
  }

  await browser.close();

  console.log('');
  console.log('═'.repeat(70));
  console.log('📊 COMPARATIVE ANALYSIS');
  console.log('═'.repeat(70));
  console.log('');

  // Extract just the typing results
  const typingResults = testResults.filter(r => r.action === 'after_typing');

  console.log('Typing "g" three times in same session:');
  console.log('');

  typingResults.forEach((result, i) => {
    console.log(`Attempt ${i + 1}:`);
    console.log(`  pwd__E2E__:     ${result.pwd__E2E__}`);
    console.log(`  __E2E_RESULT__: ${result.__E2E_RESULT__}`);
    console.log(`  __E2E_UNIQUE__: ${result.__E2E_UNIQUE__}`);
    console.log('');
  });

  // Compare pwd__E2E__ values
  const pwdE2Es = typingResults.map(r => r.pwd__E2E__);
  const uniquePwdE2E = new Set(pwdE2Es);

  console.log('═'.repeat(70));
  console.log('🎯 KEY FINDINGS:');
  console.log('═'.repeat(70));
  console.log('');

  console.log(`pwd__E2E__ uniqueness: ${uniquePwdE2E.size}/${pwdE2Es.length}`);
  console.log('');

  if (uniquePwdE2E.size === 1) {
    console.log('✅ SAME VALUE each time!');
    console.log('');
    console.log('This means:');
    console.log('  - Encryption is per-SESSION, not per-keystroke');
    console.log('  - Same character in same session = same encrypted value');
    console.log('  - Includes session token but NOT timestamp per keystroke');
    console.log('');
    console.log('Implications:');
    console.log('  ✅ We could potentially capture once per session');
    console.log('  ✅ Reuse within same session');
    console.log('  ❌ Still can\'t replay across sessions');
    console.log('');
  } else if (uniquePwdE2E.size === pwdE2Es.length) {
    console.log('❌ DIFFERENT each time!');
    console.log('');
    console.log('This means:');
    console.log('  - Encryption includes PER-KEYSTROKE randomness');
    console.log('  - Could be: timestamp, nonce, sequence number');
    console.log('  - Each keystroke gets unique encrypted value');
    console.log('');
    console.log('Implications:');
    console.log('  ❌ Cannot reuse captured values');
    console.log('  ❌ Must get fresh encryption for EACH keystroke');
    console.log('  ❌ Makes replay very difficult');
    console.log('');
  }

  // Check __E2E_UNIQUE__ field
  const uniqueFields = typingResults.map(r => r.__E2E_UNIQUE__);
  const uniqueFieldSet = new Set(uniqueFields);

  console.log(`__E2E_UNIQUE__ field: ${uniqueFieldSet.size} unique values`);
  if (uniqueFieldSet.size === 1) {
    console.log('  ✅ STATIC within session');
    console.log(`  Value: ${[...uniqueFieldSet][0]}`);
    console.log('  💡 This might be the session identifier!');
  } else {
    console.log('  ❌ Changes each keystroke');
  }
  console.log('');

  // Check clearing behavior
  console.log('═'.repeat(70));
  console.log('🧹 CLEARING BEHAVIOR:');
  console.log('═'.repeat(70));
  console.log('');

  const clearingResults = testResults.filter(r => r.action === 'after_clearing');
  clearingResults.forEach((result, i) => {
    console.log(`After clear ${i + 1}:`);
    console.log(`  Visible field: "${result.visible}"`);
    console.log(`  pwd__E2E__: ${result.pwd__E2E__ ? 'Still has value ⚠️' : 'Cleared ✅'}`);
    console.log('');
  });

  const encryptedFieldsCleared = clearingResults.every(r => !r.pwd__E2E__);
  if (encryptedFieldsCleared) {
    console.log('✅ Clearing visible field CLEARS encrypted fields');
    console.log('   Fields are synchronized');
  } else {
    console.log('⚠️  Encrypted fields persist after clearing');
    console.log('   Would need explicit clearing');
  }

  console.log('');

  // Save
  fs.writeFileSync('same-char-test-results.json', JSON.stringify(testResults, null, 2));
  console.log('💾 Saved to: same-char-test-results.json');
  console.log('');
}

testSameCharMultipleTimes().catch(console.error);
