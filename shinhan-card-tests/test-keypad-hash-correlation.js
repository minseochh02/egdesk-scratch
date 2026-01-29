/**
 * Virtual Keypad Hash Correlation Test
 *
 * Goal: Prove that clicking virtual keypad button puts the expected hash in __KH_ field
 *
 * Flow:
 * 1. Capture keypad layout from nppfs.keypad.jsp response (REAL-TIME)
 * 2. Parse character → hash mappings
 * 3. Click a character on virtual keypad
 * 4. Check if __KH_ field contains the expected hash
 * 5. If match → We can automate virtual keypad!
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
  console.log('🔬 Virtual Keypad Hash Correlation Test\n');
  console.log('═'.repeat(70));
  console.log('');

  const capturedData = {
    keypadLayouts: [],
    characterMappings: {},
    sessionID: null,
    keypadUUID: null
  };

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({ locale: 'ko-KR' });
  const page = await context.newPage();

  // Intercept keypad response to capture layout
  page.on('response', async response => {
    const url = response.url();

    if (url.includes('nppfs.keypad.jsp') && response.request().method() === 'POST') {
      console.log(`📡 Intercepted keypad response from: ${url.split('/').slice(-1)[0]}`);

      try {
        const responseText = await response.text();

        // Check if it's the keypad initialization response (has buttons)
        if (responseText.includes('keypadUuid') && responseText.includes('buttons')) {
          const keypadData = JSON.parse(responseText);

          console.log(`   Keypad UUID: ${keypadData.info?.keypadUuid}`);
          console.log(`   Field: ${keypadData.info?.inputs?.info}`);
          console.log('');

          capturedData.keypadLayouts.push(keypadData);
          capturedData.keypadUUID = keypadData.info?.keypadUuid;

          // Parse character mappings
          if (keypadData.items) {
            keypadData.items.forEach(layout => {
              if (layout.buttons) {
                layout.buttons.forEach(button => {
                  if (button.type === 'data' && button.action) {
                    const match = button.action.match(/data:([a-f0-9]+):(.)/);
                    if (match) {
                      const hash = match[1];
                      const char = match[2];

                      if (!capturedData.characterMappings[char]) {
                        capturedData.characterMappings[char] = [];
                      }

                      capturedData.characterMappings[char].push({
                        layout: layout.id,
                        hash: hash,
                        coord: button.coord
                      });
                    }
                  }
                });
              }
            });
          }
        }
      } catch (e) {
        // Not a JSON response or can't parse
      }
    }
  });

  console.log('🌐 Navigating to Shinhan Card...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  console.log('🎯 Clicking password field...');
  await page.locator('#pwd').click();
  await page.waitForTimeout(4000);

  // Get session ID
  const sessionData = await page.evaluate(() => {
    return {
      sessionID: document.querySelector('input[name="__E2E_UNIQUE__"]')?.value
    };
  });

  capturedData.sessionID = sessionData.sessionID;

  console.log('═'.repeat(70));
  console.log('📊 CAPTURED KEYPAD LAYOUT');
  console.log('═'.repeat(70));
  console.log('');
  console.log(`Session ID: ${capturedData.sessionID}`);
  console.log(`Keypad UUID: ${capturedData.keypadUUID}`);
  console.log(`Total layouts: ${capturedData.keypadLayouts.length}`);
  console.log('');

  // Show character mappings
  console.log('Character → Hash Mappings (sample):');
  const sampleChars = ['a', 'b', 'c', '1', '2', '3'];
  sampleChars.forEach(char => {
    const mappings = capturedData.characterMappings[char];
    if (mappings && mappings.length > 0) {
      console.log(`  "${char}" → ${mappings[0].hash.substring(0, 30)}... (${mappings.length} layouts)`);
    }
  });
  console.log('');

  // Capture before clicking
  const beforeClick = await page.evaluate(() => {
    const khFields = {};
    document.querySelectorAll('input[type="hidden"]').forEach(field => {
      if (field.name && field.name.startsWith('__KH_')) {
        khFields[field.name] = field.value || '';
      }
    });

    return {
      visible: document.getElementById('pwd')?.value || '',
      pwd__E2E__: document.querySelector('input[name="pwd__E2E__"]')?.value || '',
      khFields: khFields
    };
  });

  console.log('═'.repeat(70));
  console.log('MANUAL TEST: Click a character button');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Available characters in our mapping:');
  console.log(`  ${Object.keys(capturedData.characterMappings).slice(0, 20).join(', ')}`);
  console.log('');

  const clickedChar = await new Promise((resolve) => {
    rl.question('What character did you click on the virtual keypad? ', (answer) => {
      resolve(answer);
    });
  });

  console.log('');
  console.log(`You clicked: "${clickedChar}"`);
  console.log('');

  await page.waitForTimeout(1000);

  // Capture after clicking
  const afterClick = await page.evaluate(() => {
    const khFields = {};
    document.querySelectorAll('input[type="hidden"]').forEach(field => {
      if (field.name && field.name.startsWith('__KH_')) {
        khFields[field.name] = field.value || '';
      }
    });

    return {
      visible: document.getElementById('pwd')?.value || '',
      pwd__E2E__: document.querySelector('input[name="pwd__E2E__"]')?.value || '',
      khFields: khFields
    };
  });

  console.log('═'.repeat(70));
  console.log('🔍 CORRELATION CHECK');
  console.log('═'.repeat(70));
  console.log('');

  // Find which __KH_ field changed
  let changedKHField = null;
  let newHash = null;

  Object.keys(afterClick.khFields).forEach(fieldName => {
    const before = beforeClick.khFields[fieldName] || '';
    const after = afterClick.khFields[fieldName] || '';

    if (before !== after) {
      changedKHField = fieldName;
      newHash = after;
    }
  });

  if (changedKHField && newHash) {
    console.log(`Changed field: ${changedKHField}`);
    console.log(`New hash: ${newHash.substring(0, 60)}...`);
    console.log(`Length: ${newHash.length} chars`);
    console.log('');

    // Get expected hash from captured keypad layout
    const expectedMappings = capturedData.characterMappings[clickedChar];

    if (expectedMappings && expectedMappings.length > 0) {
      console.log(`Expected hash for "${clickedChar}" (from keypad layout):`);

      let foundMatch = false;

      expectedMappings.forEach((mapping, idx) => {
        console.log(`  Layout ${idx + 1} (${mapping.layout}): ${mapping.hash.substring(0, 60)}...`);

        if (newHash.includes(mapping.hash) || mapping.hash.includes(newHash.substring(0, 40))) {
          console.log('     🎉 MATCH FOUND!');
          foundMatch = true;
        }
      });

      console.log('');

      if (foundMatch) {
        console.log('✅ ✅ ✅ CORRELATION CONFIRMED! ✅ ✅ ✅');
        console.log('');
        console.log('This proves:');
        console.log('  1. Virtual keypad hash from server layout');
        console.log('  2. Goes into __KH_ field when clicked');
        console.log('  3. We can predict what hash to use');
        console.log('  4. We can automate virtual keypad clicks!');
        console.log('');
        console.log('🚀 EXPLOITATION PATH DISCOVERED:');
        console.log('  - Get keypad layout (we know how)');
        console.log('  - Build char → hash mapping (we have it)');
        console.log('  - Simulate clicks or inject hash directly');
        console.log('  - Submit with __KH_ field (bypasses HID!)');
        console.log('');
      } else {
        console.log('❌ Hashes do NOT match');
        console.log('');
        console.log(`Expected (from layout): ${expectedMappings[0].hash}`);
        console.log(`Actual (in field):      ${newHash}`);
        console.log('');
        console.log('Possible reasons:');
        console.log('  - Hash is transformed/encrypted before storing');
        console.log('  - Multiple characters combined');
        console.log('  - Different hash generation mechanism');
        console.log('');
      }
    } else {
      console.log(`⚠️  No mapping found for character "${clickedChar}"`);
      console.log('   Character might not be in captured layout');
      console.log('');
    }

  } else {
    console.log('❌ No __KH_ fields changed!');
    console.log('');
    console.log('This is unexpected. Check:');
    console.log('  - Did the click actually register?');
    console.log('  - Is the virtual keypad working?');
    console.log('');
  }

  // Save everything
  const results = {
    test: 'Virtual Keypad Hash Correlation',
    clickedCharacter: clickedChar,
    sessionID: capturedData.sessionID,
    keypadUUID: capturedData.keypadUUID,
    characterMappings: capturedData.characterMappings,
    before: beforeClick,
    after: afterClick,
    analysis: {
      changedField: changedKHField,
      newHash: newHash,
      expectedMappings: capturedData.characterMappings[clickedChar]
    }
  };

  fs.writeFileSync('keypad-hash-correlation.json', JSON.stringify(results, null, 2));
  console.log('💾 Saved to: keypad-hash-correlation.json');
  console.log('');

  await waitForEnter('Press ENTER to close browser');

  await browser.close();
  rl.close();

  process.exit(0);
})();
