/**
 * Test Virtual Keypad Click
 *
 * Goal: Click a virtual keypad button and see if its hash appears in pwd__E2E__
 *
 * Theory: If we click the button for "a", the hash from the keypad
 *         action (data:4d567a87...:a) should appear in pwd__E2E__
 *
 * This would prove we can bypass HID detection using virtual keypad!
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
  console.log('🔬 Virtual Keypad Click Test\n');
  console.log('═'.repeat(70));
  console.log('Testing: Does clicking virtual keypad button put hash in pwd__E2E__?');
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

  // Wait longer for virtual keypad to load
  console.log('⏳ Waiting for virtual keypad to appear...');
  await page.waitForTimeout(5000);

  // Check if keypad is visible (try multiple selectors)
  const keypadInfo = await page.evaluate(() => {
    const selectors = [
      '#nppfs-keypad-div',
      '[id*="nppfs"]',
      '[id*="keypad"]',
      'iframe[id*="keypad"]',
      'img[src*="keypad"]'
    ];

    for (const selector of selectors) {
      const elem = document.querySelector(selector);
      if (elem) {
        return {
          found: true,
          selector: selector,
          tagName: elem.tagName,
          visible: elem.offsetParent !== null,
          id: elem.id
        };
      }
    }

    return { found: false };
  });

  console.log('');
  console.log('Keypad search results:');
  if (keypadInfo.found) {
    console.log(`  ✅ Found: ${keypadInfo.selector}`);
    console.log(`  Tag: ${keypadInfo.tagName}`);
    console.log(`  ID: ${keypadInfo.id}`);
    console.log(`  Visible: ${keypadInfo.visible ? 'YES' : 'NO'}`);
  } else {
    console.log('  ❌ Not found with common selectors');
    console.log('  The keypad might use different structure');
  }
  console.log('');
  console.log('');

  // Capture pwd__E2E__ BEFORE clicking
  const beforeClick = await page.evaluate(() => {
    return {
      visible: document.getElementById('pwd')?.value || '',
      pwd__E2E__: document.querySelector('input[name="pwd__E2E__"]')?.value || ''
    };
  });

  console.log('📊 BEFORE clicking virtual keypad:');
  console.log(`   Visible field: "${beforeClick.visible}"`);
  console.log(`   pwd__E2E__: ${beforeClick.pwd__E2E__ ? beforeClick.pwd__E2E__.substring(0, 60) + '...' : '(empty)'}`);
  console.log(`   Length: ${beforeClick.pwd__E2E__.length} chars`);
  console.log('');

  console.log('═'.repeat(70));
  console.log('MANUAL TEST: Click ONE button on the virtual keypad');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Instructions:');
  console.log('  1. Look for the virtual keypad on the page');
  console.log('  2. Click ONE button (e.g., click "a" or "1")');
  console.log('  3. Note which character you clicked');
  console.log('  4. Come back here and press ENTER');
  console.log('');

  const clickedChar = await new Promise((resolve) => {
    rl.question('What character did you click? (e.g., "a", "1", etc.): ', (answer) => {
      resolve(answer);
    });
  });

  console.log('');
  console.log(`You clicked: "${clickedChar}"`);
  console.log('');

  // Wait a moment for the field to update
  await page.waitForTimeout(1000);

  // Capture pwd__E2E__ AFTER clicking
  const afterClick = await page.evaluate(() => {
    return {
      visible: document.getElementById('pwd')?.value || '',
      pwd__E2E__: document.querySelector('input[name="pwd__E2E__"]')?.value || ''
    };
  });

  console.log('📊 AFTER clicking virtual keypad:');
  console.log(`   Visible field: "${afterClick.visible}"`);
  console.log(`   pwd__E2E__: ${afterClick.pwd__E2E__ ? afterClick.pwd__E2E__.substring(0, 60) + '...' : '(empty)'}`);
  console.log(`   Length: ${afterClick.pwd__E2E__.length} chars`);
  console.log('');

  // Analyze changes
  console.log('═'.repeat(70));
  console.log('🔍 ANALYSIS');
  console.log('═'.repeat(70));
  console.log('');

  const lengthIncrease = afterClick.pwd__E2E__.length - beforeClick.pwd__E2E__.length;

  console.log('Changes:');
  console.log(`   Visible: "${beforeClick.visible}" → "${afterClick.visible}"`);
  console.log(`   pwd__E2E__ length: ${beforeClick.pwd__E2E__.length} → ${afterClick.pwd__E2E__.length} (+${lengthIncrease} chars)`);
  console.log('');

  if (lengthIncrease === 64) {
    console.log('✅ Added exactly 64 characters (one hash)!');
    console.log('');

    // Extract the new hash
    const newHash = afterClick.pwd__E2E__.substring(beforeClick.pwd__E2E__.length, afterClick.pwd__E2E__.length);
    console.log(`New hash appended: ${newHash}`);
    console.log('');

    // Now load the keypad data to compare
    try {
      const traceData = JSON.parse(fs.readFileSync('old-results/id-flow-trace.json', 'utf8'));
      const keypadResponses = traceData.shinhanResponses.filter(r =>
        r.endpoint === 'nppfs.keypad.jsp' && r.responseFull.includes('keypadUuid')
      );

      if (keypadResponses.length > 0) {
        console.log('🔍 Searching keypad data for this character...');
        console.log('');

        let foundMatch = false;

        for (const response of keypadResponses) {
          try {
            const keypadJSON = JSON.parse(response.responseFull);

            if (keypadJSON.items) {
              for (const layout of keypadJSON.items) {
                if (layout.buttons) {
                  for (const button of layout.buttons) {
                    if (button.action) {
                      const actionMatch = button.action.match(/data:([a-f0-9]+):(.)/);
                      if (actionMatch) {
                        const buttonHash = actionMatch[1];
                        const buttonChar = actionMatch[2];

                        if (buttonChar === clickedChar) {
                          console.log(`Found button for "${clickedChar}":`)
                          console.log(`   Expected hash: ${buttonHash}`);
                          console.log(`   Actual hash:   ${newHash}`);
                          console.log(`   Match: ${buttonHash === newHash ? '✅ YES' : '❌ NO'}`);
                          console.log('');

                          if (buttonHash === newHash) {
                            foundMatch = true;
                            console.log('🎉 PERFECT MATCH!');
                            console.log('');
                            console.log('This proves:');
                            console.log('  ✅ Virtual keypad button hash goes directly to pwd__E2E__');
                            console.log('  ✅ We can use the keypad data to predict hashes');
                            console.log('  ✅ We can automate by clicking coordinates');
                            console.log('  ✅ This BYPASSES HID detection!');
                            console.log('');
                            break;
                          }
                        }
                      }
                    }
                  }
                  if (foundMatch) break;
                }
              }
              if (foundMatch) break;
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }

        if (!foundMatch) {
          console.log('⚠️  Hash not found in keypad data');
          console.log('   Possible reasons:');
          console.log('   - Keypad layout changed/refreshed');
          console.log('   - Wrong character searched');
          console.log('   - Hash is dynamically generated');
          console.log('');
        }
      }
    } catch (e) {
      console.log('⚠️  Could not load keypad data from old-results/id-flow-trace.json');
      console.log(`   Error: ${e.message}`);
      console.log('');
    }

  } else if (lengthIncrease > 0) {
    console.log(`⚠️  Length increased by ${lengthIncrease} chars (expected 64)`);
    console.log('   Might have clicked multiple buttons or different behavior');
    console.log('');
  } else {
    console.log('❌ No change in pwd__E2E__!');
    console.log('   Virtual keypad click might not work the same way');
    console.log('');
  }

  // Save results
  const results = {
    test: 'Virtual Keypad Click Test',
    clickedCharacter: clickedChar,
    before: beforeClick,
    after: afterClick,
    changes: {
      visibleFieldChange: `"${beforeClick.visible}" → "${afterClick.visible}"`,
      pwdE2ELengthChange: `${beforeClick.pwd__E2E__.length} → ${afterClick.pwd__E2E__.length}`,
      newHashAdded: lengthIncrease === 64,
      newHash: lengthIncrease === 64 ? afterClick.pwd__E2E__.substring(beforeClick.pwd__E2E__.length) : null
    }
  };

  fs.writeFileSync('virtual-keypad-click-test.json', JSON.stringify(results, null, 2));
  console.log('💾 Saved to: virtual-keypad-click-test.json');
  console.log('');

  await waitForEnter('Press ENTER to close browser');

  await browser.close();
  rl.close();

  process.exit(0);
})();
