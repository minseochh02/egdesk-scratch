/**
 * Test: Can we decrypt the pwd__E2E__ values?
 *
 * This will tell us if it's:
 * - AES encryption (reversible) → Can decrypt with right key
 * - SHA256 hash (one-way) → Cannot decrypt at all
 */

const crypto = require('crypto');

// From same-char-test-results.json - Iteration 1
const testData = {
  pwd__E2E__: "af3b98be9bb7c2a4551df2858b8784daaf9ccc1d962f4df444a639cffa652dec",
  __KI_pwd: "4c8f84aed47272fcc7a4e456fff204622cd7be47c7a7822d5aef400f441ced3cdb922c8a0ce0c2f62d3cf8e0bd12766182d967e8e437f4239207971ae81fa24fc83cc50ddf012d3ead3195a073bd25377848fbf3658c4d5e25966ac574193078",
  __E2E_RESULT__: "7604ed9bf1a1a3eb505cef88aa479c02d6f0aa215ccd21ddb06868ba6d52f16ac480914164d47bc7267be8faa7c544fadb8cfa1e88da8b9db157d36778c9816d533f1feddb64f106f50c394747dc547d3658722ad6ac8156fa8fa7de54a8e9b5172c84c99d11ae4f13701de04721dcb0f97e8f73eaac06d0733352d1de768e708a816a5023bf90c73cb416a2d56f0371408573d3088eff275a54a95ac5ea0e70e3d5d86cced5f5ba7a884ff5c1b8bb4b09af30c0bd2e811818c3435163ccbeee7bcc81036f5bd7b2281b5954a4cf52bef0674716885bd67fc9d2ad9cf5d92b213b3872b61b4708072aaccdb237ad465cf265307ff7e7c8e2f3402ca2da50e222",
  __E2E_KEYPAD__: "4d633bb5812f844dbbb7a3cf9ad69e904ee8faa3d69f88a6f72c90038de4441cfe4cb3201694c3dc2fd6e455190c092ff3b6b6b096b29a1978d99e60da6c40d6c5d2a6ccdc57e55ce21c967280abfeadb79bd9cd8f35ca193467dd7644f40e815215ff3ff952370efea1506952383827910d222e5709773c9cda3bbcfeed4a13e1de19b5f9f0741b379b3697cef244d55236698da9ce0bb4262e22f54d806849d04d7af07d55994f50aea58bd23705a40dc3da79dc4bf0aa4d2c9e2396aca63cd349d82488d2c8f3af8efce5df8c2a9d2300947c105b4a76d10fde8b56ef308c864db1558c9265588100e690d843ba765aa2bd3d88da3b53fafebe824c867192",
  typedChar: "a",
  visibleValue: "a"
};

console.log('🔬 Decryption Test');
console.log('═'.repeat(70));
console.log('');
console.log('Testing if pwd__E2E__ can be decrypted...');
console.log('');
console.log(`Encrypted value: ${testData.pwd__E2E__}`);
console.log(`Length: ${testData.pwd__E2E__.length} chars (${testData.pwd__E2E__.length / 2} bytes)`);
console.log(`We typed: "${testData.typedChar}"`);
console.log('');

// Try various decryption methods

console.log('═'.repeat(70));
console.log('Test 1: Try AES Decryption with __KI_pwd as key');
console.log('═'.repeat(70));
console.log('');

try {
  // __KI_pwd is 192 chars = 96 bytes
  // Try using first 32 bytes (256 bits) as AES-256 key
  const keyHex = testData.__KI_pwd.substring(0, 64); // 32 bytes
  const key = Buffer.from(keyHex, 'hex');

  const encryptedHex = testData.pwd__E2E__;
  const encrypted = Buffer.from(encryptedHex, 'hex');

  console.log(`Key (first 32 bytes of __KI_pwd): ${keyHex}`);
  console.log(`Encrypted data: ${encryptedHex}`);
  console.log('');

  // Try AES-256-ECB (no IV)
  try {
    const decipher = crypto.createDecipheriv('aes-256-ecb', key, null);
    decipher.setAutoPadding(false);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    console.log('AES-256-ECB Result:');
    console.log(`  Hex: ${decrypted.toString('hex')}`);
    console.log(`  UTF-8: ${decrypted.toString('utf8')}`);
    console.log(`  ASCII: ${decrypted.toString('ascii')}`);
    console.log('');
  } catch (e) {
    console.log('AES-256-ECB failed:', e.message);
    console.log('');
  }

  // Try AES-256-CBC (with IV from different parts)
  try {
    // Try using __E2E_RESULT__ first 16 bytes as IV
    const ivHex = testData.__E2E_RESULT__.substring(0, 32); // 16 bytes
    const iv = Buffer.from(ivHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    decipher.setAutoPadding(false);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    console.log('AES-256-CBC Result (IV from __E2E_RESULT__):');
    console.log(`  Hex: ${decrypted.toString('hex')}`);
    console.log(`  UTF-8: ${decrypted.toString('utf8')}`);
    console.log(`  ASCII: ${decrypted.toString('ascii')}`);
    console.log('');
  } catch (e) {
    console.log('AES-256-CBC failed:', e.message);
    console.log('');
  }

} catch (e) {
  console.log('Decryption failed:', e.message);
  console.log('');
}

console.log('═'.repeat(70));
console.log('Test 2: Check if it looks like SHA256');
console.log('═'.repeat(70));
console.log('');

// SHA256 characteristics
console.log('SHA256 characteristics:');
console.log(`  - Length: 64 hex chars (256 bits) ✅ Matches our data`);
console.log(`  - One-way: Cannot be reversed ✓`);
console.log(`  - Deterministic: Same input = same output ✓`);
console.log('');

// Test if it's a hash of something simple
const testHashes = [
  { input: 'a', hash: crypto.createHash('sha256').update('a').digest('hex') },
  { input: 'test', hash: crypto.createHash('sha256').update('test').digest('hex') },
  { input: testData.__KI_pwd + 'a', hash: crypto.createHash('sha256').update(testData.__KI_pwd + 'a').digest('hex') }
];

console.log('Testing if it matches simple SHA256 of common inputs:');
testHashes.forEach(t => {
  const matches = t.hash === testData.pwd__E2E__;
  console.log(`  SHA256("${t.input.substring(0, 20)}..."): ${matches ? '✅ MATCH!' : '❌ No match'}`);
});
console.log('');

console.log('═'.repeat(70));
console.log('Test 3: Entropy Analysis');
console.log('═'.repeat(70));
console.log('');

// Check randomness
const chars = testData.pwd__E2E__.split('');
const charCounts = {};
chars.forEach(c => {
  charCounts[c] = (charCounts[c] || 0) + 1;
});

const uniqueChars = Object.keys(charCounts).length;
console.log(`Unique hex characters: ${uniqueChars}/16 possible`);
console.log('Character distribution:');
Object.entries(charCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([char, count]) => {
  console.log(`  '${char}': ${count} times`);
});
console.log('');

if (uniqueChars >= 14) {
  console.log('✅ High entropy - looks like cryptographic output');
  console.log('   Could be SHA256 or AES');
} else {
  console.log('⚠️  Low entropy - suspicious for crypto');
}
console.log('');

console.log('═'.repeat(70));
console.log('📊 CONCLUSION');
console.log('═'.repeat(70));
console.log('');

console.log('Based on tests:');
console.log('');
console.log('If decryption produced readable text:');
console.log('  → It\'s AES encryption (reversible)');
console.log('  → Timestamps are INSIDE the encrypted value');
console.log('  → Server decrypts to verify password + timing');
console.log('  → WebSocket not needed for timing');
console.log('');
console.log('If decryption failed / produced garbage:');
console.log('  → It\'s likely SHA256 hash (one-way)');
console.log('  → Timestamps sent separately via WebSocket');
console.log('  → Server uses WebSocket timestamps to recreate hash');
console.log('  → Two-channel architecture confirmed');
console.log('');
console.log('Next step: Capture WebSocket traffic to see if timing data is there!');
console.log('');
