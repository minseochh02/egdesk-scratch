/**
 * Analyze 96-Character Hash Structure
 *
 * Goal: Understand what the 96-char hash in __KH_ field is
 *
 * Possibilities:
 * - 96 hex chars = 48 bytes
 * - Could be: SHA384 (48 bytes)
 * - Could be: SHA256 (32 bytes) + MD5 (16 bytes) = 48 bytes
 * - Could be: 3 × SHA1 (3 × 20 bytes = 60 bytes) - doesn't match
 * - Could be: Double hashing (hash of a hash + metadata)
 */

const crypto = require('crypto');
const fs = require('fs');

console.log('🔬 Analyzing 96-Character Hash Structure\n');
console.log('═'.repeat(70));
console.log('');

// Load learned mapping
let learnedData;
try {
  learnedData = JSON.parse(fs.readFileSync('learned-keypad-mapping.json', 'utf8'));
} catch (e) {
  console.log('❌ Could not load learned-keypad-mapping.json');
  console.log('   Run learn-keypad-mapping.js first!');
  process.exit(1);
}

console.log('Loaded learned mappings:');
console.log(`  Characters: ${Object.keys(learnedData.learnedMapping).join(', ')}`);
console.log('');

// Analyze each hash
console.log('═'.repeat(70));
console.log('HASH STRUCTURE ANALYSIS');
console.log('═'.repeat(70));
console.log('');

Object.entries(learnedData.learnedMapping).forEach(([char, hash]) => {
  console.log(`Character "${char}":`);
  console.log(`  Hash: ${hash}`);
  console.log(`  Length: ${hash.length} hex chars = ${hash.length / 2} bytes`);
  console.log('');

  // Try to split into segments
  if (hash.length === 96) {
    console.log('  Possible segments:');
    console.log(`    Part 1 (64 chars): ${hash.substring(0, 64)}`);
    console.log(`    Part 2 (32 chars): ${hash.substring(64, 96)}`);
    console.log('');
    console.log('  Could be:');
    console.log('    - SHA256 (32 bytes) + MD5 (16 bytes)');
    console.log('    - SHA256 + another SHA256 (truncated)');
    console.log('    - SHA384 (48 bytes total)');
    console.log('');
  }
});

// Check if it's SHA384 of something simple
console.log('═'.repeat(70));
console.log('TEST: Is it SHA384 of the character?');
console.log('═'.repeat(70));
console.log('');

Object.entries(learnedData.learnedMapping).forEach(([char, hash]) => {
  const sha384 = crypto.createHash('sha384').update(char).digest('hex');

  console.log(`SHA384("${char}"):`);
  console.log(`  Expected: ${sha384}`);
  console.log(`  Actual:   ${hash}`);
  console.log(`  Match: ${sha384 === hash ? '✅ YES' : '❌ NO'}`);
  console.log('');
});

// Check if it's double hash (hash of hash)
console.log('═'.repeat(70));
console.log('TEST: Is it a double hash?');
console.log('═'.repeat(70));
console.log('');

Object.entries(learnedData.learnedMapping).forEach(([char, hash]) => {
  // Try: SHA384(SHA256(char))
  const innerHash = crypto.createHash('sha256').update(char).digest('hex');
  const doubleHash = crypto.createHash('sha384').update(innerHash).digest('hex');

  console.log(`SHA384(SHA256("${char}")):`);
  console.log(`  Result: ${doubleHash}`);
  console.log(`  Actual: ${hash}`);
  console.log(`  Match: ${doubleHash === hash ? '✅ YES' : '❌ NO'}`);
  console.log('');
});

// Check for patterns in the 64+32 split
console.log('═'.repeat(70));
console.log('PATTERN ANALYSIS: 64+32 Split');
console.log('═'.repeat(70));
console.log('');

const hashes = Object.values(learnedData.learnedMapping);

if (hashes.length >= 2) {
  console.log('Comparing first 64 chars across different characters:');
  console.log('');

  hashes.forEach((hash, i) => {
    const char = Object.keys(learnedData.learnedMapping)[i];
    const first64 = hash.substring(0, 64);
    console.log(`  "${char}": ${first64}`);
  });
  console.log('');

  const first64s = hashes.map(h => h.substring(0, 64));
  const uniqueFirst64 = new Set(first64s);

  if (uniqueFirst64.size === hashes.length) {
    console.log('  ✅ First 64 chars are UNIQUE for each character');
    console.log('     (Each character has different hash)');
  } else {
    console.log('  ⚠️  Some first 64 chars are SAME!');
    console.log('     (Might be session-based prefix)');
  }
  console.log('');

  console.log('Comparing last 32 chars across different characters:');
  console.log('');

  hashes.forEach((hash, i) => {
    const char = Object.keys(learnedData.learnedMapping)[i];
    const last32 = hash.substring(64, 96);
    console.log(`  "${char}": ${last32}`);
  });
  console.log('');

  const last32s = hashes.map(h => h.substring(64, 96));
  const uniqueLast32 = new Set(last32s);

  if (uniqueLast32.size === hashes.length) {
    console.log('  ✅ Last 32 chars are UNIQUE for each character');
  } else if (uniqueLast32.size === 1) {
    console.log('  🔑 Last 32 chars are SAME for all characters!');
    console.log('     (Might be session constant or checksum)');
  } else {
    console.log('  ⚠️  Last 32 chars partially shared');
  }
  console.log('');
}

console.log('═'.repeat(70));
console.log('📊 CONCLUSION');
console.log('═'.repeat(70));
console.log('');

console.log('Hash characteristics:');
console.log('  - Length: 96 hex chars = 48 bytes');
console.log('  - Structure: Appears to be 64 + 32 chars');
console.log('  - Not a standard hash algorithm (SHA256=64, SHA384=96, but didn\'t match)');
console.log('');

console.log('Most likely:');
console.log('  - Custom format: main_hash (64) + checksum/metadata (32)');
console.log('  - Or: Concatenation of two hashes');
console.log('  - Need to understand the algorithm to predict values');
console.log('');

console.log('💡 For exploitation:');
console.log('  - We don\'t need to generate these hashes ourselves');
console.log('  - We can get them from keypad layout response');
console.log('  - Just need to match hash → character (user-assisted)');
console.log('  - Then automate clicks for known passwords');
console.log('');
