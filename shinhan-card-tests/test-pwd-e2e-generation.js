/**
 * Test pwd__E2E__ Generation
 *
 * Goal: Try to recreate pwd__E2E__ by combining known data
 *
 * We have:
 * - Session ID: __E2E_UNIQUE__
 * - Session keys: __KI_pwd, __E2E_RESULT__, __E2E_KEYPAD__
 * - Password: "test" (4 chars)
 * - Actual pwd__E2E__: 256 chars (4 × 64)
 *
 * Test various combinations to see if we can recreate it
 */

const crypto = require('crypto');
const fs = require('fs');

console.log('🔬 Testing pwd__E2E__ Generation\n');
console.log('═'.repeat(70));
console.log('');

// Load captured data
const captureData = JSON.parse(fs.readFileSync('complete-login-capture.json', 'utf8'));

if (!captureData.loginPOST) {
  console.log('❌ No login POST data found!');
  console.log('   Run capture-all-login-data.js first!');
  process.exit(1);
}

const loginData = captureData.loginPOST.parsed;

// Extract data
const sessionID = loginData.__E2E_UNIQUE__;
const pwdE2E = loginData.pwd__E2E__;
const kiPwd = loginData.__KI_pwd;
const e2eResult = loginData.__E2E_RESULT__;
const e2eKeypad = loginData.__E2E_KEYPAD__;
const visiblePwd = loginData.pwd;  // "aaaa"

console.log('Known Data:');
console.log(`  Password (visible): "${visiblePwd}" (${visiblePwd.length} chars)`);
console.log(`  Session ID: ${sessionID}`);
console.log(`  __KI_pwd: ${kiPwd.substring(0, 40)}... (${kiPwd.length} chars)`);
console.log(`  __E2E_RESULT__: ${e2eResult.substring(0, 40)}... (${e2eResult.length} chars)`);
console.log(`  __E2E_KEYPAD__: ${e2eKeypad.substring(0, 40)}... (${e2eKeypad.length} chars)`);
console.log('');

console.log('Target (pwd__E2E__):');
console.log(`  Full: ${pwdE2E}`);
console.log(`  Length: ${pwdE2E.length} chars`);
console.log('');

// Split into 4 hashes (64 chars each)
const hashes = [];
for (let i = 0; i < pwdE2E.length; i += 64) {
  hashes.push(pwdE2E.substring(i, i + 64));
}

console.log(`Split into ${hashes.length} hashes (64 chars each):`);
hashes.forEach((h, i) => {
  console.log(`  Hash ${i + 1}: ${h}`);
});
console.log('');

console.log('═'.repeat(70));
console.log('TEST: Try to recreate pwd__E2E__ hashes');
console.log('═'.repeat(70));
console.log('');

const password = 'test';  // The password you typed
console.log(`Password: "${password}"`);
console.log(`Expected: ${hashes.length} hashes (64 chars each)`);
console.log('');

// Test 1: Try full word combinations
console.log('Test 1: Full word "test" combinations:');
console.log('');

const fullWordTests = [
  { name: 'SHA256("test")', value: crypto.createHash('sha256').update(password).digest('hex') },
  { name: 'SHA256("test" + sessionID)', value: crypto.createHash('sha256').update(password + sessionID).digest('hex') },
  { name: 'SHA256(sessionID + "test")', value: crypto.createHash('sha256').update(sessionID + password).digest('hex') },
  { name: 'SHA256(kiPwd + "test")', value: crypto.createHash('sha256').update(kiPwd + password).digest('hex') },
  { name: 'SHA256("test" + kiPwd)', value: crypto.createHash('sha256').update(password + kiPwd).digest('hex') },
  { name: 'SHA256(e2eResult + "test")', value: crypto.createHash('sha256').update(e2eResult + password).digest('hex') },
  { name: 'SHA256(e2eKeypad + "test")', value: crypto.createHash('sha256').update(e2eKeypad + password).digest('hex') }
];

fullWordTests.forEach(test => {
  const matchesAny = hashes.some(h => h === test.value);

  console.log(`  ${test.name}:`);
  console.log(`    Result: ${test.value}`);
  console.log(`    Matches any hash: ${matchesAny ? '✅ YES' : '❌ NO'}`);
  console.log('');
});

// Test 2: Try per-character with all combinations
console.log('─'.repeat(70));
console.log('Test 2: Per-character combinations (SHA256):');
console.log('');

for (let i = 0; i < password.length; i++) {
  const char = password[i];
  const targetHash = hashes[i];

  console.log(`Character ${i + 1}: "${char}" → Target: ${targetHash.substring(0, 40)}...`);

  const charTests = [
    { name: 'char', value: crypto.createHash('sha256').update(char).digest('hex') },
    { name: 'char + i', value: crypto.createHash('sha256').update(char + i.toString()).digest('hex') },
    { name: 'sessionID + char', value: crypto.createHash('sha256').update(sessionID + char).digest('hex') },
    { name: 'sessionID + char + i', value: crypto.createHash('sha256').update(sessionID + char + i.toString()).digest('hex') },
    { name: 'kiPwd + char', value: crypto.createHash('sha256').update(kiPwd + char).digest('hex') },
    { name: 'kiPwd + char + i', value: crypto.createHash('sha256').update(kiPwd + char + i.toString()).digest('hex') },
    { name: 'kiPwd[0:32] + char', value: crypto.createHash('sha256').update(kiPwd.substring(0, 32) + char).digest('hex') },
    { name: 'kiPwd[0:32] + char + i', value: crypto.createHash('sha256').update(kiPwd.substring(0, 32) + char + i.toString()).digest('hex') },
    { name: 'e2eResult[0:32] + char', value: crypto.createHash('sha256').update(e2eResult.substring(0, 32) + char).digest('hex') },
    { name: 'password + char + i', value: crypto.createHash('sha256').update(password + char + i.toString()).digest('hex') }
  ];

  const match = charTests.find(t => t.value === targetHash);

  if (match) {
    console.log(`  🎉 MATCH FOUND: ${match.name}`);
    console.log(`     Formula: SHA256(${match.name})`);
    console.log('');
  } else {
    console.log(`  ❌ No match (${charTests.length} attempts)`);
    console.log('');
  }
}

console.log('─'.repeat(70));
console.log('Test 3: Try different hash algorithms:');
console.log('');

const char0 = password[0];
const target0 = hashes[0];

const algorithmTests = [
  { name: 'SHA1', value: crypto.createHash('sha1').update(char0).digest('hex') },
  { name: 'SHA512', value: crypto.createHash('sha512').update(char0).digest('hex').substring(0, 64) },
  { name: 'MD5', value: crypto.createHash('md5').update(char0).digest('hex') },
  { name: 'RIPEMD160', value: crypto.createHash('ripemd160').update(char0).digest('hex') }
];

console.log(`Testing character "${char0}" with different algorithms:`);
algorithmTests.forEach(test => {
  console.log(`  ${test.name}: ${test.value === target0 ? '✅ Match' : '❌ No match'}`);
});

console.log('');

console.log('═'.repeat(70));
console.log('ADVANCED TESTS');
console.log('═'.repeat(70));
console.log('');

// Test if it uses parts of the session keys
console.log('Testing if hash uses parts of session keys:');
console.log('');

for (let i = 0; i < password.length; i++) {
  const char = password[i];
  const targetHash = hashes[i];

  console.log(`Character ${i + 1}: "${char}"`);

  // Try using different parts of __KI_pwd as key
  for (let keyLen = 16; keyLen <= 64; keyLen += 16) {
    const keyPart = kiPwd.substring(0, keyLen);
    const testHash = crypto.createHash('sha256').update(keyPart + char + i.toString()).digest('hex');

    if (testHash === targetHash) {
      console.log(`  🎉 MATCH! Formula: SHA256(__KI_pwd[0:${keyLen}] + char + position)`);
      console.log(`     Key: ${keyPart}`);
      break;
    }
  }

  // Try HMAC
  const hmacTests = [
    { name: 'HMAC-SHA256(key=kiPwd, data=char)', value: crypto.createHmac('sha256', kiPwd).update(char).digest('hex') },
    { name: 'HMAC-SHA256(key=sessionID, data=char)', value: crypto.createHmac('sha256', sessionID).update(char).digest('hex') },
    { name: 'HMAC-SHA256(key=kiPwd, data=char+pos)', value: crypto.createHmac('sha256', kiPwd).update(char + i.toString()).digest('hex') }
  ];

  hmacTests.forEach(test => {
    if (test.value === targetHash) {
      console.log(`  🎉 MATCH: ${test.name}`);
    }
  });

  console.log('');
}

console.log('═'.repeat(70));
console.log('📊 CONCLUSION');
console.log('═'.repeat(70));
console.log('');

console.log('If no matches found:');
console.log('  - Hash includes timestamp (which we don\'t have)');
console.log('  - Or uses complex algorithm we haven\'t tried');
console.log('  - Or combines multiple session keys');
console.log('  - Need to find where timestamp data comes from');
console.log('');

console.log('If match found:');
console.log('  - We can predict pwd__E2E__ values!');
console.log('  - Can bypass hardware keyboard completely!');
console.log('  - Exploit hardware keyboard path without HID!');
console.log('');
