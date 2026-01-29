/**
 * Test Virtual Keypad Hash Uniqueness
 *
 * CRITICAL TEST: Does clicking same button twice give same hash?
 *
 * This determines if virtual keypad is exploitable!
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
  console.log('🔬 Virtual Keypad Hash Uniqueness Test\n');
  console.log('═'.repeat(70));
  console.log('CRITICAL QUESTION: Same button = same hash?');
  console.log('═'.repeat(70));
  console.log('');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({ locale: 'ko-KR' });
  const page = await context.newPage();

  console.log('🌐 Navigating to Shinhan Card...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  console.log('🎯 Clicking password field...');
  await page.locator('#pwd').click();
  await page.waitForTimeout(5000);

  // Wait for __KH_ field to be created
  console.log('⏳ Waiting for virtual keypad to initialize...');

  let khFieldName = null;
  for (let i = 0; i < 10; i++) {
    khFieldName = await page.evaluate(() => {
      const khFields = Array.from(document.querySelectorAll('input[name^="__KH_"]'));
      return khFields.length > 0 ? khFields[0].name : null;
    });

    if (khFieldName) {
      break;
    }

    console.log(`   Attempt ${i + 1}/10...`);
    await page.waitForTimeout(1000);
  }

  if (!khFieldName) {
    console.log('');
    console.log('❌ No __KH_ field found after 10 seconds!');
    console.log('');
    console.log('Checking all hidden fields:');

    const allFields = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input[type="hidden"]'))
        .map(f => f.name)
        .filter(n => n);
    });

    console.log(`   Total hidden fields: ${allFields.length}`);
    console.log(`   Fields: ${allFields.slice(0, 10).join(', ')}...`);
    console.log('');
    console.log('The virtual keypad might not have loaded properly.');

    await browser.close();
    rl.close();
    process.exit(1);
  }

  console.log(`✅ Found field: ${khFieldName}`);
  console.log('');

  console.log('═'.repeat(70));
  console.log('TEST: Click same button twice');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Instructions:');
  console.log('  1. Click "a" on virtual keypad');
  console.log('  2. Press ENTER');
  console.log('  3. Click DELETE button on virtual keypad');
  console.log('  4. Press ENTER');
  console.log('  5. Click "a" AGAIN on virtual keypad');
  console.log('  6. Press ENTER');
  console.log('');

  // Click 1
  await waitForEnter('Step 1: Click "a" on virtual keypad, then press ENTER');

  const afterClick1 = await page.evaluate((fieldName) => {
    return {
      visible: document.getElementById('pwd')?.value || '',
      khValue: document.querySelector(`input[name="${fieldName}"]`)?.value || ''
    };
  }, khFieldName);

  console.log('After first click:');
  console.log(`  Visible: "${afterClick1.visible}"`);
  console.log(`  ${khFieldName}: ${afterClick1.khValue.length} chars`);
  console.log(`  Hash: ${afterClick1.khValue.substring(0, 60)}...`);
  console.log('');

  const hash1 = afterClick1.khValue;

  // Delete
  await waitForEnter('Step 2: Click DELETE button on keypad to remove the character, then press ENTER');

  const afterDelete = await page.evaluate((fieldName) => {
    return {
      visible: document.getElementById('pwd')?.value || '',
      khValue: document.querySelector(`input[name="${fieldName}"]`)?.value || ''
    };
  }, khFieldName);

  console.log('After delete:');
  console.log(`  Visible: "${afterDelete.visible}"`);
  console.log(`  ${khFieldName}: ${afterDelete.khValue.length} chars`);
  console.log('');

  // Click 2
  await waitForEnter('Step 3: Click "a" AGAIN (same button), then press ENTER');

  const afterClick2 = await page.evaluate((fieldName) => {
    return {
      visible: document.getElementById('pwd')?.value || '',
      khValue: document.querySelector(`input[name="${fieldName}"]`)?.value || ''
    };
  }, khFieldName);

  console.log('After second click:');
  console.log(`  Visible: "${afterClick2.visible}"`);
  console.log(`  ${khFieldName}: ${afterClick2.khValue.length} chars`);
  console.log(`  Hash: ${afterClick2.khValue.substring(0, 60)}...`);
  console.log('');

  const hash2 = afterClick2.khValue;

  // Analysis
  console.log('═'.repeat(70));
  console.log('🎯 CRITICAL RESULT');
  console.log('═'.repeat(70));
  console.log('');

  console.log('First "a" click:');
  console.log(`  ${hash1}`);
  console.log('');

  console.log('Second "a" click:');
  console.log(`  ${hash2}`);
  console.log('');

  const match = hash1 === hash2;

  console.log(`Match: ${match ? '✅ SAME' : '❌ DIFFERENT'}`);
  console.log('');

  if (match) {
    console.log('🎉🎉🎉 VIRTUAL KEYPAD IS EXPLOITABLE! 🎉🎉🎉');
    console.log('');
    console.log('This proves:');
    console.log('  ✅ Same button = SAME hash every time');
    console.log('  ✅ Hashes are deterministic (no timestamp/nonce)');
    console.log('  ✅ We can predict hashes from layout alone!');
    console.log('  ✅ Automation is POSSIBLE!');
    console.log('');
    console.log('Exploitation strategy:');
    console.log('  1. Get keypad layout (we know how)');
    console.log('  2. Map character → hash (user-assisted or OCR)');
    console.log('  3. For password, lookup hashes');
    console.log('  4. Inject into __KH_ field');
    console.log('  5. Submit → BYPASS HID DETECTION!');
    console.log('');
  } else {
    console.log('❌ Virtual keypad includes randomness');
    console.log('');
    console.log('This means:');
    console.log('  - Same button = different hash each time');
    console.log('  - Timestamp/nonce included (like hardware keyboard)');
    console.log('  - Can\'t predict hashes from layout');
    console.log('  - Must capture in real-time or actually click buttons');
    console.log('');
  }

  // Save results
  const results = {
    test: 'Virtual Keypad Hash Uniqueness',
    firstClick: hash1,
    secondClick: hash2,
    match: match,
    conclusion: match ? 'EXPLOITABLE' : 'NOT_EXPLOITABLE'
  };

  fs.writeFileSync('virtual-keypad-uniqueness-test.json', JSON.stringify(results, null, 2));
  console.log('💾 Saved to: virtual-keypad-uniqueness-test.json');
  console.log('');

  await waitForEnter('Press ENTER to close browser');

  await browser.close();
  rl.close();

  process.exit(0);
})();
