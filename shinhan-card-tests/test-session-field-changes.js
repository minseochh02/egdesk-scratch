/**
 * Test Which Fields Change During Typing
 *
 * Goal: Identify which fields update when user types (timestamp candidates)
 *
 * Method:
 * 1. Capture all hidden fields BEFORE typing
 * 2. User types password with hardware keyboard
 * 3. Capture all hidden fields AFTER typing
 * 4. Compare to see what changed (besides pwd__E2E__)
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
  console.log('🔬 Session Field Change Test\n');
  console.log('═'.repeat(70));
  console.log('Goal: Identify which fields change per session');
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
  await page.waitForTimeout(5000);

  // Capture BEFORE typing
  console.log('═'.repeat(70));
  console.log('BEFORE TYPING');
  console.log('═'.repeat(70));
  console.log('');

  const beforeTyping = await page.evaluate(() => {
    const fields = {};
    document.querySelectorAll('input[type="hidden"]').forEach(field => {
      if (field.name) {
        fields[field.name] = field.value || '';
      }
    });
    return {
      timestamp: Date.now(),
      fields: fields
    };
  });

  console.log(`Captured ${Object.keys(beforeTyping.fields).length} hidden fields`);
  console.log('');

  const keyFields = ['__E2E_UNIQUE__', '__E2E_RESULT__', '__E2E_KEYPAD__', '__KI_pwd'];
  console.log('Key fields:');
  keyFields.forEach(field => {
    const value = beforeTyping.fields[field];
    if (value) {
      console.log(`  ${field}: ${value.substring(0, 40)}... (${value.length} chars)`);
    }
  });
  console.log('');

  // User types
  console.log('═'.repeat(70));
  console.log('TYPE PASSWORD');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Instructions:');
  console.log('  1. Click on the password field');
  console.log('  2. Type a password with HARDWARE KEYBOARD (e.g., "test")');
  console.log('  3. Do NOT click login yet');
  console.log('  4. Press ENTER here');
  console.log('');

  await waitForEnter('Press ENTER after typing password');

  // Capture AFTER typing
  console.log('');
  console.log('═'.repeat(70));
  console.log('AFTER TYPING');
  console.log('═'.repeat(70));
  console.log('');

  const afterTyping = await page.evaluate(() => {
    const fields = {};
    document.querySelectorAll('input[type="hidden"]').forEach(field => {
      if (field.name) {
        fields[field.name] = field.value || '';
      }
    });
    return {
      timestamp: Date.now(),
      fields: fields,
      visiblePwd: document.getElementById('pwd')?.value || ''
    };
  });

  console.log(`Captured ${Object.keys(afterTyping.fields).length} hidden fields`);
  console.log(`Visible password field: "${afterTyping.visiblePwd}"`);
  console.log('');

  // Analysis
  console.log('═'.repeat(70));
  console.log('📊 BEFORE vs AFTER COMPARISON');
  console.log('═'.repeat(70));
  console.log('');

  // Find all field names
  const allFieldNames = new Set([
    ...Object.keys(beforeTyping.fields),
    ...Object.keys(afterTyping.fields)
  ]);

  console.log(`Total fields: ${allFieldNames.size}`);
  console.log('');

  // Check each field
  const fieldAnalysis = {};

  allFieldNames.forEach(fieldName => {
    const beforeValue = beforeTyping.fields[fieldName] || '';
    const afterValue = afterTyping.fields[fieldName] || '';

    fieldAnalysis[fieldName] = {
      before: beforeValue,
      after: afterValue,
      changed: beforeValue !== afterValue,
      beforeLength: beforeValue.length,
      afterLength: afterValue.length
    };
  });

  // Fields that changed
  const changingFields = Object.keys(fieldAnalysis).filter(f => fieldAnalysis[f].changed);
  const staticFields = Object.keys(fieldAnalysis).filter(f => !fieldAnalysis[f].changed && fieldAnalysis[f].beforeLength > 0);

  console.log('🔴 Fields that CHANGED while typing:');
  console.log('');

  if (changingFields.length > 0) {
    changingFields.forEach(field => {
      const data = fieldAnalysis[field];

      console.log(`  ${field}:`);
      console.log(`    Before: ${data.before.substring(0, 50)}${data.beforeLength > 50 ? '...' : ''} (${data.beforeLength} chars)`);
      console.log(`    After:  ${data.after.substring(0, 50)}${data.afterLength > 50 ? '...' : ''} (${data.afterLength} chars)`);
      console.log(`    Change: +${data.afterLength - data.beforeLength} chars`);
      console.log('');
    });
  } else {
    console.log('  (None - all fields static!)');
    console.log('');
  }

  console.log('🟢 Fields that STAYED THE SAME:');
  console.log('');

  if (staticFields.length > 0) {
    staticFields.slice(0, 10).forEach(field => {
      const value = beforeTyping.fields[field] || '';
      if (value) {
        console.log(`  ${field}: ${value.substring(0, 40)}... (${value.length} chars)`);
      }
    });

    if (staticFields.length > 10) {
      console.log(`  ... and ${staticFields.length - 10} more static fields`);
    }
    console.log('');
  }

  console.log('═'.repeat(70));
  console.log('🎯 VERDICT');
  console.log('═'.repeat(70));
  console.log('');

  console.log(`Fields that changed during typing: ${changingFields.length}`);
  console.log(`Fields that stayed static: ${staticFields.length}`);
  console.log('');

  // Check specific fields
  const e2eResultChanges = fieldAnalysis['__E2E_RESULT__']?.changed;
  const e2eKeypadChanges = fieldAnalysis['__E2E_KEYPAD__']?.changed;
  const e2eUniqueChanges = fieldAnalysis['__E2E_UNIQUE__']?.changed;
  const kiPwdChanges = fieldAnalysis['__KI_pwd']?.changed;
  const pwdE2EChanges = fieldAnalysis['pwd__E2E__']?.changed;

  console.log('Key field analysis:');
  console.log(`  pwd__E2E__: ${pwdE2EChanges ? '🔴 CHANGED' : '🟢 STATIC'} ${pwdE2EChanges ? '(expected - password hashes)' : ''}`);
  console.log(`  __E2E_UNIQUE__: ${e2eUniqueChanges ? '🔴 CHANGED' : '🟢 STATIC'} ${e2eUniqueChanges ? '(unexpected!)' : '(expected - session ID)'}`);
  console.log(`  __E2E_RESULT__: ${e2eResultChanges ? '🔴 CHANGED' : '🟢 STATIC'} ${e2eResultChanges ? '(TIMING DATA CANDIDATE!)' : '(truly static)'}`);
  console.log(`  __E2E_KEYPAD__: ${e2eKeypadChanges ? '🔴 CHANGED' : '🟢 STATIC'} ${e2eKeypadChanges ? '(TIMING DATA CANDIDATE!)' : '(truly static)'}`);
  console.log(`  __KI_pwd: ${kiPwdChanges ? '🔴 CHANGED' : '🟢 STATIC'} ${kiPwdChanges ? '(unexpected!)' : '(expected - static key)'}`);
  console.log('');

  if (e2eResultChanges || e2eKeypadChanges) {
    console.log('🔥 IMPORTANT: If __E2E_RESULT__ or __E2E_KEYPAD__ changed:');
    console.log('   These fields might contain timing/behavioral data!');
    console.log('   They update dynamically during typing!');
    console.log('');
  }

  // Save results
  fs.writeFileSync('typing-field-changes.json', JSON.stringify({
    beforeTyping: beforeTyping,
    afterTyping: afterTyping,
    visiblePassword: afterTyping.visiblePwd,
    analysis: {
      changingFields: changingFields,
      staticFields: staticFields,
      fieldChanges: fieldAnalysis
    }
  }, null, 2));

  console.log('💾 Saved to: typing-field-changes.json');
  console.log('');

  console.log('Summary:');
  console.log('  - Only pwd__E2E__ should change (expected)');
  console.log('  - If __E2E_RESULT__ or __E2E_KEYPAD__ also changed:');
  console.log('    → They contain timing data!');
  console.log('  - If nothing else changed:');
  console.log('    → Timing sent via WebSocket or not sent at all');
  console.log('');

  await waitForEnter('Press ENTER to close browser');

  await browser.close();
  rl.close();

  process.exit(0);
})();
