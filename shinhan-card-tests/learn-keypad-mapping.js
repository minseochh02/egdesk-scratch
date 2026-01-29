/**
 * Learn Virtual Keypad Mapping
 *
 * Strategy:
 * 1. Capture keypad layout (get all hashes and their mask types)
 * 2. User clicks "a", "b", "c" on virtual keypad
 * 3. Capture the 3 hashes that appear in __KH_ field
 * 4. Match: Hash 1 = "a", Hash 2 = "b", Hash 3 = "c"
 * 5. Build character → hash mapping for this session
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
  console.log('🔬 Learn Virtual Keypad Mapping\n');
  console.log('═'.repeat(70));
  console.log('Strategy: User-assisted mapping by clicking known characters');
  console.log('═'.repeat(70));
  console.log('');

  const sessionData = {
    keypadLayout: null,
    keypadUUID: null,
    allHashes: [],  // All hashes from layout
    learnedMapping: {},  // hash → character
    khFieldName: null
  };

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({ locale: 'ko-KR' });
  const page = await context.newPage();

  // Intercept keypad layout response
  page.on('response', async response => {
    const url = response.url();

    if (url.includes('nppfs.keypad.jsp') && response.request().method() === 'POST') {
      try {
        const responseText = await response.text();

        if (responseText.includes('keypadUuid') && responseText.includes('buttons')) {
          const keypadData = JSON.parse(responseText);

          console.log(`📡 Captured keypad layout: ${keypadData.info?.keypadUuid}`);

          sessionData.keypadLayout = keypadData;
          sessionData.keypadUUID = keypadData.info?.keypadUuid;
          sessionData.khFieldName = keypadData.info?.inputs?.hash;

          // Extract all hashes
          keypadData.items.forEach(layout => {
            layout.buttons.forEach(button => {
              if (button.type === 'data' && button.action) {
                const match = button.action.match(/data:([a-f0-9]+):(.)/);
                if (match) {
                  sessionData.allHashes.push({
                    hash: match[1],
                    maskType: match[2],
                    layout: layout.id,
                    coord: button.coord
                  });
                }
              }
            });
          });

          console.log(`   Extracted ${sessionData.allHashes.length} character hashes`);
          console.log('');
        }
      } catch (e) {
        // Not keypad response
      }
    }
  });

  console.log('🌐 Navigating to Shinhan Card...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  console.log('🎯 Clicking password field...');
  await page.locator('#pwd').click();
  await page.waitForTimeout(4000);

  console.log('═'.repeat(70));
  console.log('📋 KEYPAD LAYOUT SUMMARY');
  console.log('═'.repeat(70));
  console.log('');

  if (sessionData.allHashes.length > 0) {
    console.log(`Keypad UUID: ${sessionData.keypadUUID}`);
    console.log(`Hash field name: ${sessionData.khFieldName}`);
    console.log('');

    // Group by mask type
    const byMask = {};
    sessionData.allHashes.forEach(h => {
      if (!byMask[h.maskType]) byMask[h.maskType] = [];
      byMask[h.maskType].push(h);
    });

    console.log('Available buttons:');
    Object.entries(byMask).forEach(([mask, hashes]) => {
      let type = '';
      if (mask === 'a') type = 'lowercase letters';
      if (mask === 'A') type = 'uppercase letters';
      if (mask === '1') type = 'numbers';
      if (mask === '_') type = 'special chars';

      console.log(`  Mask "${mask}" (${type}): ${hashes.length} buttons`);
    });
    console.log('');
  } else {
    console.log('⚠️  No keypad layout captured!');
    console.log('   Keypad might not have loaded yet');
    console.log('');
  }

  console.log('═'.repeat(70));
  console.log('🧪 LEARNING PHASE: Click characters to build mapping');
  console.log('═'.repeat(70));
  console.log('');
  console.log('We will learn the mapping by having you click known characters');
  console.log('');
  console.log('Instructions for each character:');
  console.log('  1. I tell you which character to click');
  console.log('  2. You find that character on the virtual keypad');
  console.log('  3. Click it once');
  console.log('  4. Press ENTER here');
  console.log('  5. We capture the hash and learn the mapping');
  console.log('');

  const charsToLearn = ['a', 'b', 'c', '1', '2', '3'];
  const hashSequence = [];

  for (let i = 0; i < charsToLearn.length; i++) {
    const char = charsToLearn[i];

    console.log('─'.repeat(70));
    console.log(`Character ${i + 1}/${charsToLearn.length}: "${char}"`);
    console.log('─'.repeat(70));
    console.log('');

    // Get current state of ALL __KH_ fields
    const beforeClick = await page.evaluate(() => {
      const allKH = {};
      document.querySelectorAll('input[type="hidden"]').forEach(field => {
        if (field.name && field.name.startsWith('__KH_')) {
          allKH[field.name] = field.value || '';
        }
      });

      return {
        allKHFields: allKH,
        visible: document.getElementById('pwd')?.value || ''
      };
    });

    await waitForEnter(`Click "${char}" on the virtual keypad, then press ENTER`);

    await page.waitForTimeout(500);

    // Get updated state of ALL __KH_ fields
    const afterClick = await page.evaluate(() => {
      const allKH = {};
      document.querySelectorAll('input[type="hidden"]').forEach(field => {
        if (field.name && field.name.startsWith('__KH_')) {
          allKH[field.name] = field.value || '';
        }
      });

      return {
        allKHFields: allKH,
        visible: document.getElementById('pwd')?.value || ''
      };
    });

    console.log(`   Visible field: "${beforeClick.visible}" → "${afterClick.visible}"`);

    // Find which __KH_ field changed
    let changedField = null;
    let newHashAdded = '';

    Object.keys(afterClick.allKHFields).forEach(fieldName => {
      const before = beforeClick.allKHFields[fieldName] || '';
      const after = afterClick.allKHFields[fieldName] || '';

      if (before !== after) {
        changedField = fieldName;
        newHashAdded = after.substring(before.length);
        console.log(`   ${fieldName}: ${before.length} → ${after.length} chars (+${newHashAdded.length})`);
      }
    });

    if (!changedField) {
      console.log('   All __KH_ fields: No change detected');
      console.log('');
      console.log('   Available __KH_ fields:');
      Object.keys(beforeClick.allKHFields).forEach(f => {
        console.log(`     ${f}: ${beforeClick.allKHFields[f].length} chars`);
      });
    }

    if (newHashAdded.length > 0) {
      console.log(`   New hash: ${newHashAdded.substring(0, 60)}...`);
      console.log(`   Length: ${newHashAdded.length} chars`);
      console.log('');

      hashSequence.push({
        character: char,
        hash: newHashAdded,
        hashLength: newHashAdded.length
      });

      sessionData.learnedMapping[char] = newHashAdded;

      console.log('   ✅ Learned!');
    } else {
      console.log('   ⚠️  No new hash detected!');
      console.log('   Click might not have registered or field updates differently');
    }

    console.log('');
  }

  // Analysis
  console.log('═'.repeat(70));
  console.log('📊 LEARNED MAPPING');
  console.log('═'.repeat(70));
  console.log('');

  console.log(`Successfully learned ${Object.keys(sessionData.learnedMapping).length} characters:`);
  console.log('');

  Object.entries(sessionData.learnedMapping).forEach(([char, hash]) => {
    console.log(`  "${char}" → ${hash.substring(0, 50)}...`);

    // Try to match with keypad layout
    const matchInLayout = sessionData.allHashes.find(h =>
      hash.includes(h.hash) || h.hash === hash.substring(0, 40)
    );

    if (matchInLayout) {
      console.log(`       ✅ Found in layout (mask: "${matchInLayout.maskType}", coord: ${matchInLayout.coord.x1},${matchInLayout.coord.y1})`);
    } else {
      console.log(`       ❓ Not found in captured layout`);
    }

    console.log('');
  });

  console.log('═'.repeat(70));
  console.log('🎯 VERIFICATION');
  console.log('═'.repeat(70));
  console.log('');

  // Check hash lengths
  const hashLengths = new Set(hashSequence.map(h => h.hashLength));
  console.log(`Hash length(s): ${[...hashLengths].join(', ')} chars`);

  if (hashLengths.size === 1) {
    console.log('  ✅ Consistent length for all characters');
  } else {
    console.log('  ⚠️  Different lengths - unexpected!');
  }
  console.log('');

  // Check if hashes are unique
  const uniqueHashes = new Set(hashSequence.map(h => h.hash));
  console.log(`Unique hashes: ${uniqueHashes.size}/${hashSequence.length}`);

  if (uniqueHashes.size === hashSequence.length) {
    console.log('  ✅ Each character has unique hash (good!)');
  } else {
    console.log('  ⚠️  Duplicate hashes detected!');
  }
  console.log('');

  console.log('═'.repeat(70));
  console.log('💡 EXPLOITATION FEASIBILITY');
  console.log('═'.repeat(70));
  console.log('');

  if (Object.keys(sessionData.learnedMapping).length >= 6) {
    console.log('✅ Mapping successful!');
    console.log('');
    console.log('We can now:');
    console.log('  1. Get keypad layout for any session (nppfs.keypad.jsp)');
    console.log('  2. Have user click each char once to build mapping');
    console.log('  3. OR automate by clicking all buttons and learning mapping');
    console.log('  4. Then automate password entry for future logins');
    console.log('');
    console.log('Limitation:');
    console.log('  - Keypad scrambles each session');
    console.log('  - Need to rebuild mapping per session');
    console.log('  - But this BYPASSES HID detection!');
    console.log('');
  } else {
    console.log('⚠️  Insufficient mapping data');
    console.log('');
  }

  // Save results
  const results = {
    test: 'Virtual Keypad Mapping Learning',
    sessionID: sessionData.sessionID,
    keypadUUID: sessionData.keypadUUID,
    khFieldName: sessionData.khFieldName,
    learnedMapping: sessionData.learnedMapping,
    hashSequence: hashSequence,
    keypadLayoutHashes: sessionData.allHashes.length,
    analysis: {
      successfullyLearned: Object.keys(sessionData.learnedMapping).length,
      totalAttempted: charsToLearn.length,
      hashLength: hashLengths.size === 1 ? [...hashLengths][0] : 'varies'
    }
  };

  fs.writeFileSync('learned-keypad-mapping.json', JSON.stringify(results, null, 2));
  console.log('💾 Saved to: learned-keypad-mapping.json');
  console.log('');

  await waitForEnter('Press ENTER to close browser');

  await browser.close();
  rl.close();

  process.exit(0);
})();
