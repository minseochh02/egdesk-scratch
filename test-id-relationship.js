/**
 * Test ID Relationship
 *
 * Check if WebSocket ID is derived from __E2E_UNIQUE__ or vice versa
 */

const crypto = require('crypto');

// From our captured data
const e2eUnique = "176958520339989";  // __E2E_UNIQUE__ from hidden field
const websocketID = "fd0750725ca9404d97725f38bee3f8e1";  // ID from WebSocket message

console.log('🔬 Testing ID Relationship\n');
console.log('═'.repeat(70));
console.log('');

console.log('IDs to compare:');
console.log(`  __E2E_UNIQUE__: ${e2eUnique}`);
console.log(`  WebSocket ID:   ${websocketID}`);
console.log('');

console.log('═'.repeat(70));
console.log('Test 1: Is WebSocket ID a hash of __E2E_UNIQUE__?');
console.log('═'.repeat(70));
console.log('');

// Try various hashing algorithms
const hashTests = [
  { name: 'MD5', hash: crypto.createHash('md5').update(e2eUnique).digest('hex') },
  { name: 'SHA1', hash: crypto.createHash('sha1').update(e2eUnique).digest('hex') },
  { name: 'SHA256', hash: crypto.createHash('sha256').update(e2eUnique).digest('hex') }
];

hashTests.forEach(test => {
  const match = test.hash === websocketID || test.hash.includes(websocketID) || websocketID.includes(test.hash);
  console.log(`${test.name}("${e2eUnique}"):`);
  console.log(`  Result: ${test.hash}`);
  console.log(`  Match:  ${match ? '✅ YES' : '❌ NO'}`);
  console.log('');
});

console.log('═'.repeat(70));
console.log('Test 2: Is __E2E_UNIQUE__ derived from WebSocket ID?');
console.log('═'.repeat(70));
console.log('');

// Check if __E2E_UNIQUE__ is timestamp
const asNumber = parseInt(e2eUnique);
const asTimestamp = new Date(asNumber);
console.log(`__E2E_UNIQUE__ as timestamp:`);
console.log(`  Value: ${e2eUnique}`);
console.log(`  As number: ${asNumber}`);
console.log(`  As date: ${asTimestamp.toISOString()}`);
console.log(`  Is valid date: ${!isNaN(asTimestamp.getTime()) ? '✅ YES' : '❌ NO'}`);
console.log('');

// Check if WebSocket ID could be decoded
console.log('═'.repeat(70));
console.log('Test 3: Look for patterns');
console.log('═'.repeat(70));
console.log('');

console.log('WebSocket ID characteristics:');
console.log(`  Length: 32 chars`);
console.log(`  Format: ${/^[a-f0-9]{32}$/.test(websocketID) ? 'Hex (MD5-like)' : 'Unknown'}`);
console.log(`  Could be: MD5 hash, UUID without dashes, or random token`);
console.log('');

console.log('__E2E_UNIQUE__ characteristics:');
console.log(`  Length: ${e2eUnique.length} digits`);
console.log(`  Format: Numeric only`);
console.log(`  Could be: Timestamp, session counter, or sequential ID`);
console.log('');

console.log('═'.repeat(70));
console.log('🎯 CONCLUSION');
console.log('═'.repeat(70));
console.log('');

const idsRelated = hashTests.some(t => t.hash === websocketID);

if (idsRelated) {
  console.log('✅ IDs ARE RELATED!');
  console.log('   One is a hash of the other');
  console.log('   Server can correlate both channels using hash relationship');
} else {
  console.log('❌ IDs APPEAR UNRELATED');
  console.log('');
  console.log('Possible explanations:');
  console.log('');
  console.log('1. Different IDs for different systems:');
  console.log('   - __E2E_UNIQUE__: Browser session ID');
  console.log('   - WebSocket ID: INCA/field-specific ID');
  console.log('   - Server maintains separate tracking');
  console.log('');
  console.log('2. WebSocket ID is FIELD ID, not session ID:');
  console.log('   - Each password field has unique ID');
  console.log('   - "pwd" field ID: fd0750...');
  console.log('   - Used to identify which field data belongs to');
  console.log('');
  console.log('3. Complex derivation we haven\'t figured out:');
  console.log('   - Uses both IDs plus other data');
  console.log('   - Server-side logic we can\'t see');
  console.log('');
  console.log('Need to investigate: What IS the WebSocket ID actually identifying?');
}

console.log('');
