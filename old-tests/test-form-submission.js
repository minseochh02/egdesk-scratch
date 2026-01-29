/**
 * Form Submission Data Capture Test
 *
 * Goal: Capture EXACTLY what data gets sent to the server when submitting password
 *
 * This reveals:
 * - Are timestamps included in submission?
 * - What do __E2E_RESULT__, __E2E_KEYPAD__, etc. contain?
 * - How is the data structured?
 * - What endpoint receives the data?
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
  console.log('🔬 Form Submission Data Capture Test\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log('This test will capture ALL data sent to server');
  console.log('═══════════════════════════════════════════════════════\n');

  const capturedRequests = [];
  const allRequests = []; // Track ALL requests (GET, POST, etc.)

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

  // Intercept ALL network requests (to find session token source)
  page.on('request', request => {
    const url = request.url();
    const method = request.method();

    allRequests.push({
      timestamp: Date.now(),
      url: url,
      method: method,
      type: 'request'
    });

    // Log all POST requests (form submissions)
    if (method === 'POST') {
      console.log(`\n📤 POST Request detected:`);
      console.log(`   URL: ${url}`);
      console.log(`   Method: ${method}`);

      const postData = request.postData();
      if (postData) {
        console.log(`   Post Data Length: ${postData.length} bytes`);
      }
    }
  });

  // Intercept ALL responses (to find where session data comes from)
  page.on('response', async response => {
    const url = response.url();
    const request = response.request();
    const method = request.method();
    const status = response.status();

    let responseBody = null;
    let responseBodyPreview = null;

    try {
      responseBody = await response.text();
      responseBodyPreview = responseBody.substring(0, 200);
    } catch (e) {
      responseBody = '(could not read response body)';
      responseBodyPreview = '(could not read)';
    }

    allRequests.push({
      timestamp: Date.now(),
      url: url,
      method: method,
      status: status,
      type: 'response',
      bodyPreview: responseBodyPreview,
      bodyLength: responseBody?.length || 0
    });

    // Check if response contains E2E fields (session token source!)
    if (responseBody && (
      responseBody.includes('__E2E_UNIQUE__') ||
      responseBody.includes('__E2E_RESULT__') ||
      responseBody.includes('E2E')
    )) {
      console.log(`\n🔑 SESSION DATA DETECTED in response!`);
      console.log(`   URL: ${url}`);
      console.log(`   Status: ${status}`);
      console.log(`   Body length: ${responseBody.length} bytes`);
    }

    // Capture POST requests and responses
    if (method === 'POST') {
      const postData = request.postData();

      const captured = {
        timestamp: Date.now(),
        url: url,
        method: method,
        status: status,
        requestHeaders: request.headers(),
        postData: postData,
        postDataParsed: null,
        responseBody: responseBody
      };

      // Try to parse POST data
      if (postData) {
        try {
          // Try as JSON
          captured.postDataParsed = JSON.parse(postData);
        } catch (e1) {
          try {
            // Try as URL-encoded form data
            const params = new URLSearchParams(postData);
            captured.postDataParsed = Object.fromEntries(params.entries());
          } catch (e2) {
            captured.postDataParsed = '(could not parse)';
          }
        }
      }

      capturedRequests.push(captured);

      console.log(`\n📥 Response received:`);
      console.log(`   Status: ${status}`);
      console.log(`   Response length: ${responseBody.length} bytes`);
    }
  });

  console.log('🌐 Navigating to Shinhan Card...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');

  // Track field changes over time
  const fieldSnapshots = [];

  async function captureFieldSnapshot(label) {
    const snapshot = await page.evaluate(() => {
      const fields = {};
      document.querySelectorAll('input[type="hidden"]').forEach(field => {
        if (field.name && field.value) {
          fields[field.name] = field.value;
        }
      });
      return fields;
    });

    fieldSnapshots.push({
      timestamp: Date.now(),
      label: label,
      fields: snapshot
    });

    return snapshot;
  }

  // Snapshot 1: Immediately after page load
  console.log('\n📸 Snapshot 1: Right after page load...');
  await page.waitForTimeout(500);
  const afterPageLoad = await captureFieldSnapshot('after_page_load');
  console.log(`   Found ${Object.keys(afterPageLoad).length} hidden fields`);

  // Snapshot 2: After 3 seconds
  console.log('📸 Snapshot 2: After 3 seconds...');
  await page.waitForTimeout(2500);
  const after3Seconds = await captureFieldSnapshot('after_3_seconds');
  console.log(`   Found ${Object.keys(after3Seconds).length} hidden fields`);

  // Check if E2E fields appeared
  const e2eFieldsExist = after3Seconds['__E2E_UNIQUE__'] || after3Seconds['__E2E_RESULT__'];
  if (e2eFieldsExist) {
    console.log('   ✅ E2E session fields detected!');
    console.log(`      __E2E_UNIQUE__: ${after3Seconds['__E2E_UNIQUE__'] || '(not set)'}`);
  } else {
    console.log('   ⚠️  E2E session fields NOT YET set');
  }

  // Fill in the ID field first
  console.log('\n📝 Filling ID field with "testuser"...');
  try {
    await page.locator('#userId').fill('testuser');
    console.log('   ✅ ID field filled');
  } catch (e) {
    console.log('   ⚠️  Could not find #userId field, skipping...');
  }
  await page.waitForTimeout(500);

  console.log('\n🎯 Focusing password field...');
  await page.locator('#pwd').click();
  await page.waitForTimeout(1000);

  // Snapshot 3: After focusing password field
  console.log('📸 Snapshot 3: After focusing password field...');
  const afterFocus = await captureFieldSnapshot('after_focus');
  console.log(`   Found ${Object.keys(afterFocus).length} hidden fields`);

  // Check if focus triggered E2E initialization
  const e2eFieldsAfterFocus = afterFocus['__E2E_UNIQUE__'] || afterFocus['__E2E_RESULT__'];
  if (e2eFieldsAfterFocus && !e2eFieldsExist) {
    console.log('   🔥 E2E session fields APPEARED ON FOCUS!');
    console.log(`      __E2E_UNIQUE__: ${afterFocus['__E2E_UNIQUE__']}`);
  }

  // Capture state before typing
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('STEP 1: Capture hidden fields BEFORE typing');
  console.log('═══════════════════════════════════════════════════════');

  const beforeTyping = await captureFieldSnapshot('before_typing');

  console.log(`\nFound ${Object.keys(beforeTyping).length} hidden fields before typing`);
  console.log('Sample E2E fields:');
  const e2eFields = ['__E2E_UNIQUE__', '__E2E_RESULT__', '__E2E_KEYPAD__', '__KI_pwd'];
  e2eFields.forEach(key => {
    const val = beforeTyping[key];
    if (val) {
      console.log(`  ${key}: ${val.substring(0, 50)}${val.length > 50 ? '...' : ''}`);
    }
  });

  // User types password
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('⌨️  IMPORTANT: Type the password with REAL KEYBOARD');
  console.log('═══════════════════════════════════════════════════════');
  console.log('\nID: testuser (already filled)');
  console.log('Password: test123 (TYPE THIS NOW)\n');

  await waitForEnter('STEP 2: TYPE "test123" in the password field, then press ENTER here');

  await page.waitForTimeout(1000);

  // Capture state after typing
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('STEP 3: Capture hidden fields AFTER typing');
  console.log('═══════════════════════════════════════════════════════');

  const afterTyping = await page.evaluate(() => {
    const fields = {};
    document.querySelectorAll('input[type="hidden"]').forEach(field => {
      if (field.name && field.value) {
        fields[field.name] = field.value;
      }
    });
    return {
      fields: fields,
      visibleValue: document.getElementById('pwd')?.value || ''
    };
  });

  console.log(`\nVisible field: "${afterTyping.visibleValue}"`);
  console.log(`Expected: "aaaa111" (test123 = 4 letters + 3 numbers)`);
  console.log(`Found ${Object.keys(afterTyping.fields).length} hidden fields after typing`);

  // Check pwd__E2E__ length
  const pwdE2E = afterTyping.fields['pwd__E2E__'];
  if (pwdE2E) {
    const expectedLength = 7 * 64; // 7 characters * 64 chars per hash
    console.log(`\npwd__E2E__ length: ${pwdE2E.length} chars`);
    console.log(`Expected length: ${expectedLength} chars (7 chars × 64)`);
    console.log(`Match: ${pwdE2E.length === expectedLength ? '✅ YES' : '❌ NO'}`);
  }

  // Show which fields changed
  console.log('\n🔄 Fields that CHANGED:');
  Object.keys(afterTyping.fields).forEach(key => {
    const before = beforeTyping[key];
    const after = afterTyping.fields[key];

    if (before !== after) {
      console.log(`\n  ${key}:`);
      console.log(`    Before: ${before ? before.substring(0, 60) + '...' : '(empty)'}`);
      console.log(`    After:  ${after ? after.substring(0, 60) + '...' : '(empty)'}`);
      console.log(`    Length: ${before?.length || 0} → ${after?.length || 0}`);
    }
  });

  // Prepare to capture form submission
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('STEP 4: Submit the form');
  console.log('═══════════════════════════════════════════════════════');
  console.log('\n⚠️  IMPORTANT:');
  console.log('   - Network monitoring is ACTIVE');
  console.log('   - All POST requests will be captured');
  console.log('   - Click the LOGIN/SUBMIT button when ready');
  console.log('   - Come back here after you see the response\n');

  await waitForEnter('Press ENTER, then click the LOGIN button in the browser');

  // Wait for network activity to settle
  console.log('\n⏳ Waiting for form submission (30 seconds max)...');
  await page.waitForTimeout(30000);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 CAPTURED NETWORK REQUESTS');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log(`Total POST requests captured: ${capturedRequests.length}\n`);

  if (capturedRequests.length === 0) {
    console.log('⚠️  No POST requests were captured!');
    console.log('   Either:');
    console.log('   - Form was not submitted');
    console.log('   - Submission uses a different method');
    console.log('   - Request was blocked/intercepted');
  } else {
    capturedRequests.forEach((req, idx) => {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`REQUEST #${idx + 1}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`URL: ${req.url}`);
      console.log(`Status: ${req.status}`);
      console.log(`\nPost Data (raw): ${req.postData?.substring(0, 200)}...`);
      console.log(`\nPost Data (parsed):`);
      console.log(JSON.stringify(req.postDataParsed, null, 2));
      console.log(`\nResponse: ${req.responseBody.substring(0, 500)}...`);
    });
  }

  // Analyze when E2E fields first appeared
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🔍 SESSION TOKEN INITIALIZATION ANALYSIS');
  console.log('═══════════════════════════════════════════════════════\n');

  for (let i = 0; i < fieldSnapshots.length; i++) {
    const snapshot = fieldSnapshots[i];
    const hasE2E = snapshot.fields['__E2E_UNIQUE__'] ? true : false;

    console.log(`Snapshot ${i + 1}: ${snapshot.label}`);
    console.log(`  __E2E_UNIQUE__: ${hasE2E ? snapshot.fields['__E2E_UNIQUE__'] : '(not set)'}`);
    console.log(`  Total fields: ${Object.keys(snapshot.fields).length}`);

    if (i > 0) {
      const prev = fieldSnapshots[i - 1];
      const newFields = Object.keys(snapshot.fields).filter(k => !prev.fields[k]);
      if (newFields.length > 0) {
        console.log(`  🆕 New fields: ${newFields.join(', ')}`);
      }
    }
    console.log('');
  }

  // Save all captured data
  const outputData = {
    testCredentials: {
      userId: 'testuser',
      password: 'test123',
      passwordLength: 7,
      visiblePassword: afterTyping.visibleValue
    },
    fieldSnapshots,
    beforeTyping,
    afterTyping: afterTyping.fields,
    capturedRequests,
    allNetworkRequests: allRequests,
    summary: {
      totalRequests: allRequests.length,
      totalPOSTRequests: capturedRequests.length,
      fieldsChanged: Object.keys(afterTyping.fields).filter(key => beforeTyping[key] !== afterTyping.fields[key]),
      sessionTokenFirstSeen: fieldSnapshots.find(s => s.fields['__E2E_UNIQUE__'])?.label || 'never',
      expectedHashCount: 7,
      actualHashCount: afterTyping.fields['pwd__E2E__'] ? afterTyping.fields['pwd__E2E__'].length / 64 : 0
    }
  };

  fs.writeFileSync('form-submission-data.json', JSON.stringify(outputData, null, 2));
  console.log('\n💾 Saved complete data to: form-submission-data.json');

  // Show network requests that might have delivered session data
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🌐 NETWORK REQUESTS (First 10)');
  console.log('═══════════════════════════════════════════════════════\n');

  allRequests.slice(0, 10).forEach((req, idx) => {
    console.log(`${idx + 1}. [${req.type.toUpperCase()}] ${req.method} ${req.url.substring(0, 80)}`);
    if (req.type === 'response') {
      console.log(`   Status: ${req.status}, Size: ${req.bodyLength} bytes`);
    }
  });

  // Pretty print key fields
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🔑 KEY FIELDS IN SUBMISSION');
  console.log('═══════════════════════════════════════════════════════\n');

  const keyFields = ['pwd__E2E__', '__E2E_RESULT__', '__E2E_KEYPAD__', '__KI_pwd', '__E2E_UNIQUE__'];
  keyFields.forEach(fieldName => {
    const value = afterTyping.fields[fieldName];
    if (value) {
      console.log(`${fieldName}:`);
      console.log(`  Length: ${value.length} chars`);
      console.log(`  Value: ${value.substring(0, 100)}...`);
      console.log('');
    }
  });

  await waitForEnter('\nTest complete! Press ENTER to close browser');

  await browser.close();
  rl.close();

  process.exit(0);
})();
