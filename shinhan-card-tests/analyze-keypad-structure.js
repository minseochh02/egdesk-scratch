/**
 * Analyze Virtual Keypad Structure
 *
 * Goal: Understand the keypad layout data structure
 * - What are coord vs preCoord?
 * - What are the different action types?
 * - How does the scrambled keypad work?
 */

const fs = require('fs');

console.log('🔍 Virtual Keypad Structure Analysis\n');
console.log('═'.repeat(70));
console.log('');

// Read trace data
const traceData = JSON.parse(fs.readFileSync('old-results/id-flow-trace.json', 'utf8'));

// Find keypad responses
const keypadResponses = traceData.shinhanResponses.filter(r =>
  r.endpoint === 'nppfs.keypad.jsp' && r.responseFull.includes('keypadUuid')
);

console.log(`Found ${keypadResponses.length} keypad initialization responses\n`);

// Analyze first keypad (pwd field)
const firstKeypad = JSON.parse(keypadResponses[0].responseFull);

console.log('═'.repeat(70));
console.log('KEYPAD METADATA');
console.log('═'.repeat(70));
console.log('');

console.log('Basic Info:');
console.log(`  UUID: ${firstKeypad.info.keypadUuid}`);
console.log(`  Type: ${firstKeypad.info.type}`);
console.log(`  Mode: ${firstKeypad.info.mode}`);
console.log(`  Dimensions: ${firstKeypad.info.iw}x${firstKeypad.info.ih} (internal)`);
console.log(`  Dimensions: ${firstKeypad.info.tw}x${firstKeypad.info.th} (total)`);
console.log('');

console.log('Input Mappings:');
console.log(`  Hash field:   ${firstKeypad.info.inputs.hash}`);
console.log(`  Use-yn field: ${firstKeypad.info.inputs.useyn}`);
console.log(`  Info field:   ${firstKeypad.info.inputs.info}`);
console.log('');

console.log('═'.repeat(70));
console.log('BUTTON TYPES BREAKDOWN');
console.log('═'.repeat(70));
console.log('');

// Analyze all layouts
const allActionTypes = new Set();
const actionExamples = {};

firstKeypad.items.forEach(layout => {
  layout.buttons.forEach(button => {
    if (button.action) {
      const actionType = button.action.split(':')[0];
      allActionTypes.add(actionType);

      if (!actionExamples[actionType]) {
        actionExamples[actionType] = [];
      }

      if (actionExamples[actionType].length < 3) {
        actionExamples[actionType].push({
          type: button.type,
          action: button.action,
          coord: button.coord,
          preCoord: button.preCoord
        });
      }
    }
  });
});

console.log('Action Types Found:');
console.log('');

// Analyze each action type
if (actionExamples['data']) {
  console.log('1. TYPE: "data" (Character Input Buttons)');
  console.log('   Purpose: Buttons that type characters');
  console.log('');
  console.log('   Examples:');
  actionExamples['data'].slice(0, 5).forEach(ex => {
    const match = ex.action.match(/data:([a-f0-9]+):(.)/);
    if (match) {
      const hash = match[1];
      const maskChar = match[2];
      console.log(`     ${ex.action}`);
      console.log(`       Hash: ${hash.substring(0, 30)}...`);
      console.log(`       Mask: "${maskChar}" (visible field shows this)`);
      console.log(`       Coord: (${ex.coord.x1}, ${ex.coord.y1})`);
      console.log(`       PreCoord: (${ex.preCoord.x1}, ${ex.preCoord.y1})`);
      console.log('');
    }
  });
}

if (actionExamples['action']) {
  console.log('2. TYPE: "action" (Control Buttons)');
  console.log('   Purpose: Buttons that perform actions (not character input)');
  console.log('');
  console.log('   Examples:');
  actionExamples['action'].forEach(ex => {
    console.log(`     ${ex.action}`);

    if (ex.action.includes('close')) {
      console.log(`       → Closes the keypad`);
    } else if (ex.action.includes('show:')) {
      const showWhat = ex.action.split(':')[2];
      console.log(`       → Switches to "${showWhat}" layout (uppercase/lowercase/special)`);
    } else if (ex.action.includes('delete')) {
      console.log(`       → Deletes last character (backspace)`);
    } else if (ex.action.includes('clear')) {
      console.log(`       → Clears entire field`);
    } else if (ex.action.includes('enter')) {
      console.log(`       → Enter/submit`);
    } else if (ex.action.includes('refresh')) {
      console.log(`       → Refreshes keypad (rescramble)`);
    }

    console.log(`       Coord: (${ex.coord.x1}, ${ex.coord.y1})`);
    console.log('');
  });
}

console.log('═'.repeat(70));
console.log('COORD vs PRECOORD EXPLANATION');
console.log('═'.repeat(70));
console.log('');

// Compare coord vs preCoord
const sampleButton = firstKeypad.items[0].buttons.find(b => b.type === 'data');

if (sampleButton) {
  console.log('Example button:');
  console.log(`  Action: ${sampleButton.action}`);
  console.log('');
  console.log(`  coord (actual position):    x1=${sampleButton.coord.x1}, y1=${sampleButton.coord.y1}`);
  console.log(`  preCoord (preview position): x1=${sampleButton.preCoord.x1}, y1=${sampleButton.preCoord.y1}`);
  console.log('');
  console.log('Theory:');
  console.log('  - coord: Where button is on the scrambled keypad');
  console.log('  - preCoord: Where button shows in preview/hover state?');
  console.log('  - Keypad scrambles by changing coord positions');
  console.log('');
}

console.log('═'.repeat(70));
console.log('CHARACTER TYPE DISTRIBUTION');
console.log('═'.repeat(70));
console.log('');

// Count each mask type
const maskTypes = { a: 0, A: 0, '1': 0, '_': 0 };

firstKeypad.items.forEach(layout => {
  layout.buttons.forEach(button => {
    if (button.type === 'data' && button.action) {
      const match = button.action.match(/data:[a-f0-9]+:(.)/);
      if (match) {
        const mask = match[1];
        maskTypes[mask] = (maskTypes[mask] || 0) + 1;
      }
    }
  });
});

console.log('Mask character counts (all layouts combined):');
Object.entries(maskTypes).forEach(([mask, count]) => {
  let description = '';
  if (mask === 'a') description = '(lowercase letters)';
  if (mask === 'A') description = '(uppercase letters)';
  if (mask === '1') description = '(numbers)';
  if (mask === '_') description = '(special characters)';

  console.log(`  "${mask}" ${description}: ${count} buttons`);
});
console.log('');

console.log('💡 This means:');
console.log(`   - ${maskTypes['a'] || 0} buttons type lowercase letters (we don't know which)`);
console.log(`   - ${maskTypes['1'] || 0} buttons type numbers (we don't know which)`);
console.log(`   - The keypad is SCRAMBLED - same hash = same character`);
console.log('');

console.log('═'.repeat(70));
console.log('LAYOUTS');
console.log('═'.repeat(70));
console.log('');

firstKeypad.items.forEach(layout => {
  console.log(`Layout: "${layout.id}"`);
  console.log(`  Total buttons: ${layout.buttons.length}`);

  const buttonTypes = {};
  layout.buttons.forEach(b => {
    buttonTypes[b.type] = (buttonTypes[b.type] || 0) + 1;
  });

  console.log(`  Button types:`);
  Object.entries(buttonTypes).forEach(([type, count]) => {
    console.log(`    ${type}: ${count}`);
  });
  console.log('');
});

console.log('═'.repeat(70));
console.log('📊 KEY INSIGHTS');
console.log('═'.repeat(70));
console.log('');

console.log('1. SCRAMBLING MECHANISM:');
console.log('   - Server sends button coordinates (coord)');
console.log('   - Each session has different coord values (scrambled)');
console.log('   - Same hash always = same character (consistent within session)');
console.log('');

console.log('2. MASK CHARACTERS:');
console.log('   - The character after the hash (":a", ":1", etc.) is the MASK');
console.log('   - Shows in visible field, NOT the actual character');
console.log('   - "a" = any lowercase, "1" = any number, etc.');
console.log('');

console.log('3. MULTIPLE LAYOUTS:');
console.log('   - "lower" layout: lowercase letters + numbers');
console.log('   - "upper" layout: uppercase letters + numbers');
console.log('   - "special" layout: special characters');
console.log('   - User switches between layouts using action buttons');
console.log('');

console.log('4. BUTTON ACTIONS:');
console.log('   - data:<hash>:<mask> → Types character (hash sent to __KH_)');
console.log('   - action:close → Close keypad');
console.log('   - action:show:<layout> → Switch layout');
console.log('   - action:delete → Backspace');
console.log('   - action:clear → Clear field');
console.log('   - action:enter → Submit');
console.log('');

console.log('═'.repeat(70));
console.log('🚨 EXPLOITATION CHALLENGE');
console.log('═'.repeat(70));
console.log('');

console.log('Problem:');
console.log('  - We get the hashes from keypad response ✅');
console.log('  - We DON\'T know which hash = which actual character ❌');
console.log('  - Only know the mask type (lowercase/number/etc.)');
console.log('');

console.log('Possible Solutions:');
console.log('  1. Visual recognition (OCR) to see button labels');
console.log('  2. User-assisted mapping (click each char once)');
console.log('  3. Trial and error (brute force button positions)');
console.log('  4. Reverse engineer INCA\'s scrambling algorithm');
console.log('');

console.log('Next test: Capture user clicking "abc" to build mapping');
console.log('');
