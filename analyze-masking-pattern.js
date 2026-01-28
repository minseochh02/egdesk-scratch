/**
 * Password Masking Pattern Analyzer
 *
 * DISCOVERY: Veraport masks password in DOM:
 * - Numbers (0-9) → "1"
 * - Letters (a-z, A-Z) → "a"
 * - Special chars → probably "a" or something else
 *
 * This means:
 * 1. We can SEE the pattern in DOM
 * 2. Real password is stored elsewhere (encrypted?)
 * 3. We might be able to inject the masked pattern
 *
 * Run this to analyze the masking behavior
 */

const { chromium } = require('playwright-core');
const fs = require('fs');

async function analyzeMaskingPattern() {
  console.log('🔍 Veraport Password Masking Analyzer');
  console.log('═'.repeat(70));
  console.log('');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
    ]
  });

  const context = await browser.newContext({
    locale: 'ko-KR',
    viewport: { width: 1280, height: 1024 }
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const page = await context.newPage();

  // Navigate to Shinhan Card
  console.log('📍 Navigating to Shinhan Card...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  // Find password field
  const passwordField = page.locator('[id="pwd"]');
  await passwordField.click();
  await page.waitForTimeout(2000);

  console.log('');
  console.log('🎯 INSTRUCTIONS:');
  console.log('1. Manually type a test password in the password field');
  console.log('2. Use a pattern like: Test123!@#');
  console.log('3. Watch what appears in the field');
  console.log('4. Press ENTER here when done');
  console.log('');

  await new Promise(resolve => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    readline.question('Press ENTER after typing password: ', () => {
      readline.close();
      resolve();
    });
  });

  // Analyze what's in the field
  console.log('');
  console.log('🔍 Analyzing password field...');
  console.log('');

  const analysis = await page.evaluate(() => {
    const field = document.getElementById('pwd');

    return {
      // DOM value
      domValue: field.value,
      domValueLength: field.value.length,

      // Attributes
      type: field.type,
      autocomplete: field.autocomplete,

      // Check for hidden fields
      hiddenFields: Array.from(document.querySelectorAll('input[type="hidden"]'))
        .map(f => ({
          name: f.name,
          id: f.id,
          value: f.value?.substring(0, 50)
        })),

      // Check for data attributes on password field
      dataAttributes: Array.from(field.attributes)
        .filter(attr => attr.name.startsWith('data-'))
        .map(attr => ({ name: attr.name, value: attr.value })),

      // Check for custom properties
      customProperties: Object.keys(field)
        .filter(key => !key.startsWith('_') && key.length > 3)
        .slice(0, 20),

      // Parent form data
      formData: field.form ? {
        action: field.form.action,
        method: field.form.method,
        enctype: field.form.enctype
      } : null,

      // Check window for stored password
      windowVars: Object.keys(window)
        .filter(key => key.toLowerCase().includes('password') ||
                       key.toLowerCase().includes('pwd') ||
                       key.toLowerCase().includes('encrypt'))
        .slice(0, 10)
    };
  });

  console.log('📊 ANALYSIS RESULTS:');
  console.log('═'.repeat(70));
  console.log('');

  console.log('1️⃣ DOM Value (what we can see):');
  console.log(`   Value: "${analysis.domValue}"`);
  console.log(`   Length: ${analysis.domValueLength} characters`);
  console.log(`   Pattern: ${analyzeMaskPattern(analysis.domValue)}`);
  console.log('');

  console.log('2️⃣ Hidden Fields (where real password might be):');
  if (analysis.hiddenFields.length > 0) {
    analysis.hiddenFields.forEach(f => {
      console.log(`   ${f.name || f.id}: ${f.value}`);
    });
  } else {
    console.log('   No hidden fields found');
  }
  console.log('');

  console.log('3️⃣ Data Attributes:');
  if (analysis.dataAttributes.length > 0) {
    analysis.dataAttributes.forEach(attr => {
      console.log(`   ${attr.name}: ${attr.value}`);
    });
  } else {
    console.log('   No data attributes');
  }
  console.log('');

  console.log('4️⃣ Window Variables (password-related):');
  if (analysis.windowVars.length > 0) {
    console.log(`   Found: ${analysis.windowVars.join(', ')}`);
  } else {
    console.log('   No password-related variables found');
  }
  console.log('');

  // Test: Can we set the masked value directly?
  console.log('5️⃣ TESTING: Can we inject masked pattern?');
  console.log('');

  const testPattern = 'aaaa111aaa'; // Matches "Test123!@#"
  console.log(`   Attempting to set field to: "${testPattern}"`);

  const injectionTest = await page.evaluate((pattern) => {
    const field = document.getElementById('pwd');

    // Try multiple methods
    const results = {
      fill: false,
      value: false,
      type: false,
      finalValue: ''
    };

    // Method 1: Direct assignment
    try {
      field.value = pattern;
      results.value = field.value === pattern;
    } catch (e) {
      results.value = false;
    }

    // Method 2: Dispatch events
    try {
      field.value = pattern;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      results.type = field.value === pattern;
    } catch (e) {
      results.type = false;
    }

    results.finalValue = field.value;
    return results;
  }, testPattern);

  console.log(`   Direct assignment: ${injectionTest.value ? '✅ Worked' : '❌ Blocked'}`);
  console.log(`   With events: ${injectionTest.type ? '✅ Worked' : '❌ Blocked'}`);
  console.log(`   Final value: "${injectionTest.finalValue}"`);
  console.log('');

  // Monitor form submission
  console.log('6️⃣ Form Submission Data:');
  console.log('   Tip: Try submitting the form manually and check network tab');
  console.log('');

  console.log('═'.repeat(70));
  console.log('💡 KEY INSIGHTS:');
  console.log('═'.repeat(70));
  console.log('');

  if (analysis.domValue.match(/^[a1]+$/)) {
    console.log('✅ CONFIRMED: Password is masked in DOM!');
    console.log('   Pattern: Numbers→"1", Letters→"a"');
    console.log('');
    console.log('🎯 POSSIBLE EXPLOITS:');
    console.log('');
    console.log('   1. INJECT MASKED PATTERN:');
    console.log('      - Set field.value to "aaaa111aaa"');
    console.log('      - Security keyboard might accept it');
    console.log('      - Real encryption happens elsewhere');
    console.log('');
    console.log('   2. FIND REAL PASSWORD STORAGE:');
    console.log('      - Check hidden fields');
    console.log('      - Check window variables');
    console.log('      - Monitor form submission data');
    console.log('      - Look for encrypted value in POST request');
    console.log('');
    console.log('   3. INTERCEPT ENCRYPTION:');
    console.log('      - Find encryption function');
    console.log('      - Call it directly with your password');
    console.log('      - Inject encrypted result');
    console.log('');
  }

  if (analysis.hiddenFields.length > 0) {
    console.log('✅ FOUND HIDDEN FIELDS!');
    console.log('   These might contain the real encrypted password');
    console.log('   Check their values after manual typing');
    console.log('');
  }

  console.log('🔬 NEXT EXPERIMENTS:');
  console.log('   1. Type password manually and capture form POST data');
  console.log('   2. Look for encryption function in JavaScript');
  console.log('   3. Try injecting masked pattern and see if login works');
  console.log('   4. Monitor network traffic for encrypted password');
  console.log('');

  console.log('Browser will stay open for 60 seconds...');
  await page.waitForTimeout(60000);

  await browser.close();
}

function analyzeMaskPattern(maskedValue) {
  if (!maskedValue) return 'Empty';

  const chars = maskedValue.split('');
  const pattern = chars.map(c => {
    if (c === '1') return 'NUM';
    if (c === 'a') return 'CHAR';
    return `OTHER(${c})`;
  }).join('-');

  const counts = {
    numbers: chars.filter(c => c === '1').length,
    letters: chars.filter(c => c === 'a').length,
    other: chars.filter(c => c !== '1' && c !== 'a').length
  };

  return `${pattern} (${counts.numbers}nums, ${counts.letters}chars, ${counts.other}other)`;
}

// Run
analyzeMaskingPattern().catch(console.error);
