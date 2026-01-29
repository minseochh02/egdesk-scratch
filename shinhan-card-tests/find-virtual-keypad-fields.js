/**
 * Find Virtual Keypad Hidden Fields
 *
 * Goal: Discover which hidden fields get populated when using virtual keypad
 *
 * Theory: Virtual keypad uses DIFFERENT hidden fields than hardware keyboard
 *         Maybe __KH_ fields instead of pwd__E2E__?
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
  console.log('🔬 Find Virtual Keypad Hidden Fields\n');
  console.log('═'.repeat(70));
  console.log('Goal: Discover which fields change when clicking virtual keypad');
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
  await page.waitForTimeout(3000);

  // Capture ALL hidden fields BEFORE clicking virtual keypad
  const beforeClick = await page.evaluate(() => {
    const allFields = {};
    document.querySelectorAll('input[type="hidden"]').forEach(field => {
      if (field.name) {
        allFields[field.name] = field.value || '';
      }
    });

    return {
      visible: document.getElementById('pwd')?.value || '',
      allHiddenFields: allFields,
      totalFields: Object.keys(allFields).length
    };
  });

  console.log('');
  console.log('📊 BEFORE clicking virtual keypad:');
  console.log(`   Visible field: "${beforeClick.visible}"`);
  console.log(`   Total hidden fields: ${beforeClick.totalFields}`);
  console.log('');

  // Show key fields
  const keyFields = ['pwd__E2E__', '__KH_cfa51a22c246', '__KH_f2d9a769a585', '__KH_ddea529f05d4'];
  console.log('   Key hidden fields:');
  keyFields.forEach(field => {
    const value = beforeClick.allHiddenFields[field];
    if (value !== undefined) {
      console.log(`     ${field}: ${value ? value.substring(0, 40) + '...' : '(empty)'}`);
    }
  });
  console.log('');

  console.log('═'.repeat(70));
  console.log('MANUAL TEST: Click ONE button on virtual keypad');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Instructions:');
  console.log('  1. Find the virtual keypad on the page');
  console.log('  2. Click ONE character button (e.g., "a" or "1")');
  console.log('  3. Watch which character appears in the password field');
  console.log('');

  const clickedChar = await new Promise((resolve) => {
    rl.question('What character did you click? ', (answer) => {
      resolve(answer);
    });
  });

  console.log('');
  console.log(`You clicked: "${clickedChar}"`);
  console.log('');

  // Wait for fields to update
  await page.waitForTimeout(1000);

  // Capture ALL hidden fields AFTER clicking
  const afterClick = await page.evaluate(() => {
    const allFields = {};
    document.querySelectorAll('input[type="hidden"]').forEach(field => {
      if (field.name) {
        allFields[field.name] = field.value || '';
      }
    });

    return {
      visible: document.getElementById('pwd')?.value || '',
      allHiddenFields: allFields,
      totalFields: Object.keys(allFields).length
    };
  });

  console.log('📊 AFTER clicking virtual keypad:');
  console.log(`   Visible field: "${afterClick.visible}"`);
  console.log(`   Total hidden fields: ${afterClick.totalFields}`);
  console.log('');

  // Show key fields after
  console.log('   Key hidden fields:');
  keyFields.forEach(field => {
    const value = afterClick.allHiddenFields[field];
    if (value !== undefined) {
      console.log(`     ${field}: ${value ? value.substring(0, 40) + '...' : '(empty)'}`);
    }
  });
  console.log('');

  // Find what changed
  console.log('═'.repeat(70));
  console.log('🔍 FIELDS THAT CHANGED');
  console.log('═'.repeat(70));
  console.log('');

  const changedFields = [];

  Object.keys(afterClick.allHiddenFields).forEach(fieldName => {
    const before = beforeClick.allHiddenFields[fieldName] || '';
    const after = afterClick.allHiddenFields[fieldName] || '';

    if (before !== after) {
      changedFields.push({
        fieldName: fieldName,
        before: before,
        after: after,
        lengthChange: after.length - before.length
      });
    }
  });

  if (changedFields.length > 0) {
    console.log(`Found ${changedFields.length} field(s) that changed:`);
    console.log('');

    changedFields.forEach(change => {
      console.log(`📌 ${change.fieldName}:`);
      console.log(`   Before: ${change.before ? change.before.substring(0, 50) + '...' : '(empty)'}`);
      console.log(`   After:  ${change.after ? change.after.substring(0, 50) + '...' : '(empty)'}`);
      console.log(`   Length: ${change.before.length} → ${change.after.length} (+${change.lengthChange})`);
      console.log('');

      // If it's a __KH_ field (keypad hash), this is the virtual keypad data!
      if (change.fieldName.startsWith('__KH_')) {
        console.log('   🔥 This is a KEYPAD HASH field!');
        console.log('   Virtual keypad uses __KH_ fields instead of pwd__E2E__!');
        console.log('');
      }
    });

    console.log('═'.repeat(70));
    console.log('🎯 CONCLUSION');
    console.log('═'.repeat(70));
    console.log('');

    const hasKHField = changedFields.some(c => c.fieldName.startsWith('__KH_'));
    const hasPwdE2E = changedFields.some(c => c.fieldName === 'pwd__E2E__');

    if (hasKHField && !hasPwdE2E) {
      console.log('✅ DISCOVERY: Virtual keypad uses __KH_ fields!');
      console.log('');
      console.log('This means:');
      console.log('  - Hardware keyboard → pwd__E2E__ (encrypted hashes)');
      console.log('  - Virtual keypad → __KH_<uuid> (keypad hashes)');
      console.log('  - Server accepts BOTH methods');
      console.log('');
      console.log('💡 Potential bypass:');
      console.log('  1. Get virtual keypad layout (nppfs.keypad.jsp)');
      console.log('  2. Find character coordinates and hashes');
      console.log('  3. Simulate clicks on virtual keypad');
      console.log('  4. Build __KH_ field from keypad hashes');
      console.log('  5. Submit form (bypasses HID detection!)');
      console.log('');
    } else if (hasPwdE2E) {
      console.log('🤔 Unexpected: pwd__E2E__ was populated by virtual keypad');
      console.log('   Virtual keypad might use same mechanism as keyboard');
      console.log('');
    } else {
      console.log('⚠️  No expected fields changed');
      console.log('   Data might be in different location');
      console.log('');
    }

  } else {
    console.log('⚠️  No fields changed!');
    console.log('');
    console.log('Possible reasons:');
    console.log('  - Virtual keypad click didn\'t register');
    console.log('  - Fields update on different event (form submit?)');
    console.log('  - Need to wait longer for update');
    console.log('');
  }

  // Save detailed comparison
  const results = {
    test: 'Virtual Keypad Field Discovery',
    clickedCharacter: clickedChar,
    before: beforeClick,
    after: afterClick,
    changedFields: changedFields,
    analysis: {
      visibleFieldUpdated: beforeClick.visible !== afterClick.visible,
      anyHiddenFieldsChanged: changedFields.length > 0,
      khFieldsChanged: changedFields.filter(c => c.fieldName.startsWith('__KH_')),
      pwdE2EChanged: changedFields.some(c => c.fieldName === 'pwd__E2E__')
    }
  };

  fs.writeFileSync('virtual-keypad-fields.json', JSON.stringify(results, null, 2));
  console.log('💾 Saved detailed comparison to: virtual-keypad-fields.json');
  console.log('');

  await waitForEnter('Press ENTER to close browser');

  await browser.close();
  rl.close();

  process.exit(0);
})();
