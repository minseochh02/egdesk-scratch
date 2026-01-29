/**
 * Compare Virtual Keypad vs Hardware Keyboard Submissions
 *
 * CRITICAL TEST: Find timestamp field by comparing submissions
 *
 * Strategy:
 * 1. Submit using virtual keypad (no timestamp)
 * 2. Submit using hardware keyboard (has timestamp)
 * 3. Compare POST data to find the difference
 * 4. The different field = timestamp data!
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
  console.log('🔬 Virtual vs Hardware Submission Comparison\n');
  console.log('═'.repeat(70));
  console.log('Goal: Find timestamp field by comparing two submission methods');
  console.log('═'.repeat(70));
  console.log('');

  const submissions = {
    virtual: null,
    hardware: null
  };

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({ locale: 'ko-KR' });
  const page = await context.newPage();

  // Intercept login POST requests
  page.on('request', request => {
    const url = request.url();
    const method = request.method();

    if (method === 'POST' && url.includes('CMMServiceMemLoginC.ajax')) {
      console.log('\n📤 LOGIN POST INTERCEPTED!');

      const postData = request.postData();
      console.log(`   Data length: ${postData?.length} bytes`);

      // Parse POST data
      try {
        const params = new URLSearchParams(postData);
        const data = Object.fromEntries(params.entries());

        console.log(`   Fields: ${Object.keys(data).length}`);
        console.log('');

        // Determine if virtual or hardware based on fields
        if (data['pwd__E2E__']) {
          console.log('   Type: HARDWARE KEYBOARD (has pwd__E2E__)');
          submissions.hardware = {
            timestamp: Date.now(),
            url: url,
            postData: postData,
            parsed: data
          };
        } else if (Object.keys(data).some(k => k.startsWith('__KH_'))) {
          console.log('   Type: VIRTUAL KEYPAD (has __KH_ field)');
          submissions.virtual = {
            timestamp: Date.now(),
            url: url,
            postData: postData,
            parsed: data
          };
        }
      } catch (e) {
        console.log('   (Could not parse POST data)');
      }
    }
  });

  console.log('═'.repeat(70));
  console.log('TEST 1: Virtual Keypad Submission');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Instructions:');
  console.log('  1. Enter ID: testuser');
  console.log('  2. Use VIRTUAL KEYPAD to type password: test');
  console.log('  3. Click LOGIN button');
  console.log('  4. Wait for response');
  console.log('  5. Press ENTER here');
  console.log('');

  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  await waitForEnter('Complete Test 1, then press ENTER');

  if (!submissions.virtual) {
    console.log('⚠️  No virtual keypad submission captured');
    console.log('   Did you click the login button?');
    console.log('');
  } else {
    console.log('✅ Virtual keypad submission captured!');
    console.log('');
  }

  console.log('═'.repeat(70));
  console.log('TEST 2: Hardware Keyboard Submission');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Instructions:');
  console.log('  1. Refresh the page or close keypad');
  console.log('  2. Enter ID: testuser');
  console.log('  3. Use HARDWARE KEYBOARD to type password: test');
  console.log('  4. Click LOGIN button');
  console.log('  5. Wait for response');
  console.log('  6. Press ENTER here');
  console.log('');

  await waitForEnter('When ready, press ENTER to proceed to Test 2');

  // Reload page for fresh session
  console.log('🔄 Reloading page for Test 2...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  await waitForEnter('Complete Test 2, then press ENTER');

  if (!submissions.hardware) {
    console.log('⚠️  No hardware keyboard submission captured');
    console.log('   Did you use hardware keyboard and click login?');
    console.log('');
  } else {
    console.log('✅ Hardware keyboard submission captured!');
    console.log('');
  }

  // Compare
  console.log('═'.repeat(70));
  console.log('🔍 COMPARISON ANALYSIS');
  console.log('═'.repeat(70));
  console.log('');

  if (!submissions.virtual || !submissions.hardware) {
    console.log('❌ Missing data, cannot compare');
    console.log(`   Virtual: ${submissions.virtual ? 'Captured' : 'Missing'}`);
    console.log(`   Hardware: ${submissions.hardware ? 'Captured' : 'Missing'}`);

    await browser.close();
    rl.close();
    process.exit(1);
  }

  const virtualFields = Object.keys(submissions.virtual.parsed);
  const hardwareFields = Object.keys(submissions.hardware.parsed);

  console.log('Fields in each submission:');
  console.log(`  Virtual: ${virtualFields.length} fields`);
  console.log(`  Hardware: ${hardwareFields.length} fields`);
  console.log('');

  // Fields only in hardware (candidates for timestamp!)
  const onlyInHardware = hardwareFields.filter(f => !virtualFields.includes(f));
  const onlyInVirtual = virtualFields.filter(f => !hardwareFields.includes(f));
  const inBoth = hardwareFields.filter(f => virtualFields.includes(f));

  console.log('🔑 Fields ONLY in hardware keyboard submission:');
  if (onlyInHardware.length > 0) {
    onlyInHardware.forEach(field => {
      const value = submissions.hardware.parsed[field];
      console.log(`  ${field}: ${value?.substring(0, 60)}...`);
    });
    console.log('');
    console.log('🔥 These fields likely contain TIMESTAMP/TIMING DATA!');
  } else {
    console.log('  (None - all fields present in both)');
  }
  console.log('');

  console.log('Fields ONLY in virtual keypad submission:');
  if (onlyInVirtual.length > 0) {
    onlyInVirtual.forEach(field => {
      const value = submissions.virtual.parsed[field];
      console.log(`  ${field}: ${value?.substring(0, 60)}...`);
    });
  } else {
    console.log('  (None)');
  }
  console.log('');

  console.log('Fields in BOTH (check if values differ):');
  console.log('');

  const differentValues = [];

  inBoth.forEach(field => {
    const virtualVal = submissions.virtual.parsed[field];
    const hardwareVal = submissions.hardware.parsed[field];

    if (virtualVal !== hardwareVal) {
      differentValues.push({
        field: field,
        virtual: virtualVal,
        hardware: hardwareVal
      });
    }
  });

  if (differentValues.length > 0) {
    console.log(`Found ${differentValues.length} fields with different values:`);
    console.log('');

    differentValues.forEach(diff => {
      // Skip the obvious ones (pwd, password hash fields)
      if (diff.field === 'pwd' || diff.field === 'pwd__E2E__' || diff.field.startsWith('__KH_')) {
        return;
      }

      console.log(`  ${diff.field}:`);
      console.log(`    Virtual:  ${diff.virtual?.substring(0, 60)}...`);
      console.log(`    Hardware: ${diff.hardware?.substring(0, 60)}...`);
      console.log(`    Lengths: ${diff.virtual?.length} vs ${diff.hardware?.length}`);
      console.log('');
    });

    console.log('🎯 Fields with different values (excluding password fields):');
    console.log('   These could contain timing/behavioral data!');
  } else {
    console.log('All common fields have same values');
    console.log('(Timestamp might be in hardware-only fields)');
  }

  console.log('');

  // Save detailed comparison
  const comparison = {
    virtual: submissions.virtual,
    hardware: submissions.hardware,
    analysis: {
      onlyInHardware: onlyInHardware,
      onlyInVirtual: onlyInVirtual,
      differentValues: differentValues.map(d => ({
        field: d.field,
        virtualLength: d.virtual?.length,
        hardwareLength: d.hardware?.length
      }))
    }
  };

  fs.writeFileSync('virtual-vs-hardware-comparison.json', JSON.stringify(comparison, null, 2));
  console.log('💾 Saved to: virtual-vs-hardware-comparison.json');
  console.log('');

  console.log('═'.repeat(70));
  console.log('🎯 CONCLUSION');
  console.log('═'.repeat(70));
  console.log('');

  console.log('Next: Examine the unique/different fields');
  console.log('  - Fields only in hardware = timestamp candidates');
  console.log('  - Fields with different values = might contain timing');
  console.log('  - This reveals where behavioral biometrics data is sent!');
  console.log('');

  await waitForEnter('Press ENTER to close browser');

  await browser.close();
  rl.close();

  process.exit(0);
})();
