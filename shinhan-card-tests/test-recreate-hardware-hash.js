/**
 * Test: Recreate Hardware Keyboard Hash
 *
 * Goal: Try to recreate pwd__E2E__ hash using known session data
 *
 * We know:
 * - Hash is position-based (proven!)
 * - Same char + same position = same hash
 * - Formula: SHA256(??? + char + position)
 *
 * Candidates for the key:
 * - __E2E_UNIQUE__ (session ID)
 * - __E2E_RESULT__ (512 chars)
 * - __E2E_KEYPAD__ (512 chars)
 */

const crypto = require('crypto');
const fs = require('fs');

console.log('🔬 Recreate Hardware Keyboard Hash\n');
console.log('═'.repeat(70));
console.log('');

// Load test data
let testData;
try {
  testData = JSON.parse(fs.readFileSync('position-hash-test.json', 'utf8'));
} catch (e) {
  console.log('❌ No position-hash-test.json found!');
  console.log('   Run test-same-char-same-session.js first!');
  process.exit(1);
}

console.log('Loaded test data:');
console.log(`  Character: "${testData.character}"`);
console.log(`  Session ID: ${testData.sessionID}`);
console.log(`  Position: 0 (first character)`);
console.log(`  Target hash: ${testData.step1_hash_position1}`);
console.log('');

// Load session fields from complete capture
let captureData;
try {
  captureData = JSON.parse(fs.readFileSync('complete-login-capture.json', 'utf8'));
} catch (e) {
  console.log('⚠️  No complete-login-capture.json found');
  console.log('   Will test with limited data');
  captureData = null;
}

const char = testData.character;
const position = 0;
const targetHash = testData.step1_hash_position1;
const sessionID = testData.sessionID;

let e2eResult = null;
let e2eKeypad = null;

if (captureData && captureData.loginPOST) {
  e2eResult = captureData.loginPOST.parsed.__E2E_RESULT__;
  e2eKeypad = captureData.loginPOST.parsed.__E2E_KEYPAD__;
}

console.log('Session data available:');
console.log(`  __E2E_UNIQUE__: ${sessionID}`);
console.log(`  __E2E_RESULT__: ${e2eResult ? e2eResult.substring(0, 40) + '... (' + e2eResult.length + ' chars)' : '(not available)'}`);
console.log(`  __E2E_KEYPAD__: ${e2eKeypad ? e2eKeypad.substring(0, 40) + '... (' + e2eKeypad.length + ' chars)' : '(not available)'}`);
console.log('');

console.log('═'.repeat(70));
console.log('TEST: Try to recreate hash with different keys');
console.log('═'.repeat(70));
console.log('');

const tests = [
  // Using __E2E_UNIQUE__ (session ID)
  { name: 'SHA256(char)', formula: char },
  { name: 'SHA256(char + position)', formula: char + position },
  { name: 'SHA256(sessionID + char)', formula: sessionID + char },
  { name: 'SHA256(sessionID + char + position)', formula: sessionID + char + position },
  { name: 'SHA256(char + sessionID)', formula: char + sessionID },
  { name: 'SHA256(char + position + sessionID)', formula: char + position + sessionID },
  { name: 'SHA256(position + char + sessionID)', formula: position + char + sessionID }
];

// Add tests with __E2E_RESULT__ if available
if (e2eResult) {
  tests.push(
    { name: 'SHA256(e2eResult + char)', formula: e2eResult + char },
    { name: 'SHA256(e2eResult + char + position)', formula: e2eResult + char + position },
    { name: 'SHA256(e2eResult[0:32] + char)', formula: e2eResult.substring(0, 32) + char },
    { name: 'SHA256(e2eResult[0:64] + char + position)', formula: e2eResult.substring(0, 64) + char + position }
  );
}

// Add tests with __E2E_KEYPAD__ if available
if (e2eKeypad) {
  tests.push(
    { name: 'SHA256(e2eKeypad + char)', formula: e2eKeypad + char },
    { name: 'SHA256(e2eKeypad + char + position)', formula: e2eKeypad + char + position },
    { name: 'SHA256(e2eKeypad[0:32] + char)', formula: e2eKeypad.substring(0, 32) + char }
  );
}

console.log(`Testing ${tests.length} combinations...\n`);

let foundMatch = false;

tests.forEach(test => {
  const hash = crypto.createHash('sha256').update(test.formula).digest('hex');
  const match = hash === targetHash;

  if (match) {
    console.log(`🎉🎉🎉 MATCH FOUND! 🎉🎉🎉`);
    console.log('');
    console.log(`Formula: ${test.name}`);
    console.log(`Result: ${hash}`);
    console.log('');
    console.log('This is the EXACT formula used!');
    console.log('We can now generate pwd__E2E__ for any password!');
    console.log('');
    foundMatch = true;
  }
});

if (!foundMatch) {
  console.log('❌ No matches found from simple combinations');
  console.log('');
  console.log('Trying more complex formulas...');
  console.log('');

  // Try HMAC
  const hmacTests = [
    { name: 'HMAC-SHA256(key=sessionID, data=char)', key: sessionID, data: char },
    { name: 'HMAC-SHA256(key=sessionID, data=char+pos)', key: sessionID, data: char + position }
  ];

  if (e2eResult) {
    hmacTests.push(
      { name: 'HMAC-SHA256(key=e2eResult, data=char)', key: e2eResult, data: char },
      { name: 'HMAC-SHA256(key=e2eResult[0:32], data=char+pos)', key: e2eResult.substring(0, 32), data: char + position }
    );
  }

  hmacTests.forEach(test => {
    const hash = crypto.createHmac('sha256', test.key).update(test.data).digest('hex');

    if (hash === targetHash) {
      console.log(`🎉 HMAC MATCH: ${test.name}`);
      foundMatch = true;
    }
  });

  if (!foundMatch) {
    console.log('');
    console.log('Still no match. The formula might be:');
    console.log('  - Using partial keys (different substring lengths)');
    console.log('  - Combining multiple session fields');
    console.log('  - Using data we haven\'t captured yet');
    console.log('  - Custom encryption/hashing algorithm');
  }
}

console.log('');
console.log('═'.repeat(70));
console.log('📊 SUMMARY');
console.log('═'.repeat(70));
console.log('');

console.log('What we know FOR SURE:');
console.log('  ✅ Hash is position-based (verified!)');
console.log('  ✅ Same char + same position = same hash');
console.log('  ✅ NO timestamp in hash');
console.log('');

if (foundMatch) {
  console.log('What we just discovered:');
  console.log('  🎉 We found the hash generation formula!');
  console.log('  🎉 We can generate pwd__E2E__ for any password!');
  console.log('  🎉 Complete bypass of hardware keyboard!');
  console.log('');
} else {
  console.log('What we still need:');
  console.log('  ❓ Exact hash formula (need more testing)');
  console.log('  ❓ Which session field(s) are used as key');
  console.log('  ❓ How they\'re combined');
  console.log('');
}

console.log('Target hash to crack:');
console.log(`  ${targetHash}`);
console.log('');
console.log('Save this for reference and continue testing!');
console.log('');
