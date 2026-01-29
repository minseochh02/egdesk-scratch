/**
 * Encryption Pattern Analyzer
 *
 * Theory: The encrypted values contain more than just the password
 * - Possibly: password + timestamp + session token + salt
 * - This explains why same input gives different encrypted values
 *
 * Test:
 * 1. Type "g" multiple times (10 runs)
 * 2. Capture all encrypted field values
 * 3. Compare to find patterns
 * 4. Analyze structure
 */

const { chromium } = require('playwright-core');
const fs = require('fs');

async function runSingleTest(testNumber) {
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

  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  // Focus field
  await page.locator('[id="pwd"]').click();
  await page.waitForTimeout(2000);

  console.log(`Test ${testNumber}: Type "g" now and press ENTER`);

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

  // Capture ALL encrypted fields
  const captured = await page.evaluate(() => {
    const fields = {};
    document.querySelectorAll('input[type="hidden"]').forEach(field => {
      if (field.name && field.value) {
        fields[field.name] = field.value;
      }
    });

    return {
      timestamp: Date.now(),
      visible: document.getElementById('pwd')?.value || '',
      allFields: fields
    };
  });

  await browser.close();

  return captured;
}

async function analyzeEncryptionPattern() {
  console.log('🔬 Encryption Pattern Analyzer');
  console.log('═'.repeat(70));
  console.log('');
  console.log('We will type "g" multiple times and compare encrypted values');
  console.log('to find patterns and understand what\'s being encrypted.');
  console.log('');
  console.log('Running 5 tests...');
  console.log('');

  const results = [];

  // Run 5 tests
  for (let i = 1; i <= 5; i++) {
    console.log('═'.repeat(70));
    console.log(`TEST ${i}/5`);
    console.log('═'.repeat(70));
    console.log('');

    const result = await runSingleTest(i);
    results.push(result);

    console.log(`✅ Test ${i} complete`);
    console.log(`   Visible: "${result.visible}"`);
    console.log(`   pwd__E2E__: ${result.allFields['pwd__E2E__']?.substring(0, 40)}...`);
    console.log('');

    if (i < 5) {
      console.log('⏳ Waiting 2 seconds before next test...');
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log('');
  console.log('═'.repeat(70));
  console.log('📊 PATTERN ANALYSIS');
  console.log('═'.repeat(70));
  console.log('');

  // Compare all pwd__E2E__ values
  const pwdE2EValues = results.map(r => r.allFields['pwd__E2E__'] || '');

  console.log('All pwd__E2E__ values for character "g":');
  console.log('');
  pwdE2EValues.forEach((val, i) => {
    console.log(`Test ${i + 1}: ${val}`);
  });
  console.log('');

  // Check for common patterns
  console.log('═'.repeat(70));
  console.log('🔍 PATTERN DETECTION:');
  console.log('═'.repeat(70));
  console.log('');

  // 1. Are they all different?
  const uniqueValues = new Set(pwdE2EValues);
  console.log(`1. Uniqueness: ${uniqueValues.size}/${pwdE2EValues.length} unique values`);
  if (uniqueValues.size === pwdE2EValues.length) {
    console.log('   ✅ All different → Includes timestamp/nonce/session data');
  } else {
    console.log('   ⚠️  Some duplicates → May have static component');
  }
  console.log('');

  // 2. Check length consistency
  const lengths = pwdE2EValues.map(v => v.length);
  const allSameLength = lengths.every(l => l === lengths[0]);
  console.log(`2. Length: ${allSameLength ? 'All ' + lengths[0] + ' chars ✅' : 'Varies: ' + lengths.join(', ')}`);
  if (allSameLength && lengths[0] === 64) {
    console.log('   💡 64 chars = 32 bytes = Likely SHA-256 hash');
  } else if (allSameLength && lengths[0] === 128) {
    console.log('   💡 128 chars = 64 bytes = Likely SHA-512 or concatenated hashes');
  }
  console.log('');

  // 3. Check for common prefixes/suffixes
  console.log('3. Common patterns:');

  // Check first 10 chars
  const first10 = pwdE2EValues.map(v => v.substring(0, 10));
  const first10Set = new Set(first10);
  console.log(`   First 10 chars: ${first10Set.size} unique`);
  if (first10Set.size === 1) {
    console.log(`     Common prefix: ${[...first10Set][0]}`);
    console.log('     💡 Might be: Version/format identifier');
  }

  // Check last 10 chars
  const last10 = pwdE2EValues.map(v => v.substring(v.length - 10));
  const last10Set = new Set(last10);
  console.log(`   Last 10 chars: ${last10Set.size} unique`);
  if (last10Set.size === 1) {
    console.log(`     Common suffix: ${[...last10Set][0]}`);
  }
  console.log('');

  // 4. Check other fields for patterns
  console.log('4. Other encrypted fields:');
  console.log('');

  const fieldNames = ['__E2E_RESULT__', '__E2E_KEYPAD__', '__KI_pwd', '__E2E_UNIQUE__'];

  fieldNames.forEach(fieldName => {
    const values = results.map(r => r.allFields[fieldName] || '(empty)');
    const uniqueCount = new Set(values).size;

    console.log(`   ${fieldName}:`);
    console.log(`     Unique values: ${uniqueCount}/${values.length}`);

    if (uniqueCount === 1) {
      console.log(`     Value: ${values[0]?.substring(0, 50)}...`);
      console.log('     💡 STATIC - Same every time!');
    } else if (uniqueCount === values.length) {
      console.log('     💡 DYNAMIC - Changes every time');
      values.forEach((v, i) => {
        console.log(`       Test ${i + 1}: ${v?.substring(0, 40)}...`);
      });
    }
    console.log('');
  });

  console.log('═'.repeat(70));
  console.log('🎯 CONCLUSIONS:');
  console.log('═'.repeat(70));
  console.log('');

  console.log('Based on pattern analysis:');
  console.log('');

  if (uniqueValues.size === pwdE2EValues.length) {
    console.log('✅ pwd__E2E__ includes time-based or random data');
    console.log('   This explains why:');
    console.log('   - Replay attack failed (different each time)');
    console.log('   - We need fresh encryption for each login');
    console.log('');
    console.log('   Likely format: Hash(password + timestamp + session_token)');
    console.log('');
  }

  console.log('If other fields are STATIC:');
  console.log('  → They might be session/page-level tokens');
  console.log('  → We might be able to reuse those!');
  console.log('');

  console.log('If other fields are DYNAMIC:');
  console.log('  → Everything is time-based');
  console.log('  → Must get fresh values for each attempt');
  console.log('');

  // Save all results
  fs.writeFileSync('encryption-pattern-analysis.json', JSON.stringify({
    testCount: results.length,
    character: 'g',
    results: results,
    analysis: {
      pwdE2E_unique: uniqueValues.size,
      pwdE2E_values: pwdE2EValues,
      lengths: lengths
    }
  }, null, 2));

  console.log('💾 Full analysis saved to: encryption-pattern-analysis.json');
  console.log('');
  console.log('═'.repeat(70));
  console.log('💡 KEY INSIGHT:');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Since WebSocket messages are STATIC but encryption is DYNAMIC:');
  console.log('');
  console.log('  The encrypted value is NOT coming through WebSocket!');
  console.log('');
  console.log('  It must be set via:');
  console.log('    A) Direct memory write from nosstarter.npe');
  console.log('    B) Kernel driver injection');
  console.log('    C) Browser extension with special access');
  console.log('    D) Different IPC mechanism');
  console.log('');
  console.log('Next test: Run test-kernel-vs-browser.js');
  console.log('  → See if JavaScript property setter catches it');
  console.log('  → Or if it bypasses JavaScript entirely');
  console.log('');
}

analyzeEncryptionPattern().catch(console.error);
