/**
 * Decode Button "Hash"
 *
 * Theory: The 40-char "hash" might be encoded image/coordinate data, not a cryptographic hash
 */

const fs = require('fs');

console.log('🔬 Decoding Button "Hash" Data\n');
console.log('═'.repeat(70));
console.log('');

// Get sample hashes from keypad layout
let layoutData;
try {
  layoutData = JSON.parse(fs.readFileSync('old-results/keypad-layout.json', 'utf8'));
} catch (e) {
  console.log('❌ No keypad-layout.json found in old-results/');
  console.log('   Run capture-keypad-html-and-image.js first!');
  process.exit(1);
}

// Get sample buttons
const sampleButtons = [];
layoutData.items.forEach(layout => {
  layout.buttons.forEach(button => {
    if (button.type === 'data' && button.action && sampleButtons.length < 10) {
      const match = button.action.match(/data:([a-f0-9]+):(.)/);
      if (match) {
        sampleButtons.push({
          hash: match[1],
          maskChar: match[2],
          layout: layout.id,
          coord: button.coord,
          preCoord: button.preCoord
        });
      }
    }
  });
});

console.log(`Analyzing ${sampleButtons.length} sample buttons...\n`);

sampleButtons.forEach((button, idx) => {
  console.log(`Button ${idx + 1}: [${button.maskChar}] in "${button.layout}" layout`);
  console.log(`  "Hash": ${button.hash}`);
  console.log(`  coord:    (${button.coord.x1}, ${button.coord.y1}) → (${button.coord.x2}, ${button.coord.y2})`);
  console.log(`  preCoord: (${button.preCoord.x1}, ${button.preCoord.y1}) → (${button.preCoord.x2}, ${button.preCoord.y2})`);
  console.log('');

  // Try to decode as integers
  const hexStr = button.hash;

  console.log('  Decode attempts:');

  // Try as 20 bytes (40 hex chars)
  const bytes = [];
  for (let i = 0; i < hexStr.length; i += 2) {
    bytes.push(parseInt(hexStr.substring(i, i + 2), 16));
  }

  console.log(`    As bytes: [${bytes.slice(0, 10).join(', ')}...]`);

  // Try first 4 bytes as integer
  const int1 = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
  const int2 = (bytes[4] << 24) | (bytes[5] << 16) | (bytes[6] << 8) | bytes[7];
  const int3 = (bytes[8] << 24) | (bytes[9] << 16) | (bytes[10] << 8) | bytes[11];
  const int4 = (bytes[12] << 24) | (bytes[13] << 16) | (bytes[14] << 8) | bytes[15];

  console.log(`    First 4 bytes as int:  ${int1}`);
  console.log(`    Next 4 bytes as int:   ${int2}`);
  console.log(`    Next 4 bytes as int:   ${int3}`);
  console.log(`    Next 4 bytes as int:   ${int4}`);

  // Check if any match coordinates
  const coordValues = [button.coord.x1, button.coord.y1, button.coord.x2, button.coord.y2];
  const preCoordValues = [button.preCoord.x1, button.preCoord.y1, button.preCoord.x2, button.preCoord.y2];

  const matches = [];
  [int1, int2, int3, int4].forEach((val, i) => {
    if (coordValues.includes(val)) {
      matches.push(`int${i+1} matches coord value ${val}`);
    }
    if (preCoordValues.includes(val)) {
      matches.push(`int${i+1} matches preCoord value ${val}`);
    }
  });

  if (matches.length > 0) {
    console.log(`    🔥 MATCHES FOUND:`);
    matches.forEach(m => console.log(`       ${m}`));
  } else {
    console.log(`    ❌ No coordinate matches`);
  }

  console.log('');
  console.log('─'.repeat(70));
  console.log('');
});

console.log('═'.repeat(70));
console.log('📊 PATTERN ANALYSIS');
console.log('═'.repeat(70));
console.log('');

// Check if "hashes" for same mask type share patterns
const byMask = {};
sampleButtons.forEach(btn => {
  if (!byMask[btn.maskChar]) byMask[btn.maskChar] = [];
  byMask[btn.maskChar].push(btn.hash);
});

console.log('Comparing "hashes" by mask type:\n');

Object.entries(byMask).forEach(([mask, hashes]) => {
  console.log(`Mask "${mask}":`);

  if (hashes.length > 1) {
    console.log(`  Hash 1: ${hashes[0]}`);
    console.log(`  Hash 2: ${hashes[1]}`);

    // Check for common prefix/suffix
    let commonPrefix = 0;
    for (let i = 0; i < Math.min(hashes[0].length, hashes[1].length); i++) {
      if (hashes[0][i] === hashes[1][i]) {
        commonPrefix++;
      } else {
        break;
      }
    }

    console.log(`  Common prefix: ${commonPrefix} chars (${hashes[0].substring(0, commonPrefix)})`);

    if (commonPrefix > 0) {
      console.log(`    💡 Share ${commonPrefix}-char prefix (might be mask/layout identifier)`);
    }
  }

  console.log('');
});

console.log('═'.repeat(70));
console.log('🎯 CONCLUSION');
console.log('═'.repeat(70));
console.log('');

console.log('The 40-char "hash" could be:');
console.log('  1. Actual cryptographic hash (SHA1 of something)');
console.log('  2. Encoded coordinate/image data (160 bits of position info)');
console.log('  3. Unique button identifier (random/generated per session)');
console.log('  4. Encrypted data (button info encrypted with session key)');
console.log('');

console.log('For exploitation, it doesn\'t matter what it is!');
console.log('  - Server tells us hash → mask type mapping');
console.log('  - We learn hash → character by clicking');
console.log('  - We can reuse hashes within same session');
console.log('');
