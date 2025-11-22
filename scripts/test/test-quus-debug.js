/**
 * Debug why quus.cloud works in Chrome but not in Node.js
 */

const testUrl = 'https://quus.cloud';

console.log('Debugging quus.cloud connection...\n');

// Test 1: Check DNS resolution
console.log('Test 1: DNS Resolution');
try {
  const dns = await import('dns/promises');
  const addresses = await dns.resolve4('quus.cloud');
  console.log(`✅ IPv4 addresses: ${addresses.join(', ')}`);
  
  try {
    const addresses6 = await dns.resolve6('quus.cloud');
    console.log(`✅ IPv6 addresses: ${addresses6.join(', ')}`);
  } catch (e) {
    console.log(`   No IPv6 addresses`);
  }
} catch (error) {
  console.log(`❌ DNS resolution failed: ${error.message}`);
}

console.log('\n---\n');

// Test 2: Try with Chrome's User-Agent
console.log('Test 2: Fetch with Chrome User-Agent');
try {
  const startTime = Date.now();
  const response = await fetch(testUrl, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    },
  });
  const elapsed = Date.now() - startTime;
  console.log(`✅ Succeeded in ${elapsed}ms`);
  console.log(`   Status: ${response.status} ${response.statusText}`);
  console.log(`   Content-Type: ${response.headers.get('content-type')}`);
} catch (error) {
  console.log(`❌ Failed`);
  console.log(`   Error: ${error.message}`);
  if (error.cause) {
    console.log(`   Cause: ${JSON.stringify(error.cause, null, 2)}`);
  }
}

console.log('\n---\n');

// Test 3: Try with undici and different TLS options
console.log('Test 3: Undici with custom TLS options');
try {
  const { fetch: undiciFetch, Agent } = await import('undici');
  
  const agent = new Agent({
    connect: {
      timeout: 30000,
      // Try with more permissive TLS options
      rejectUnauthorized: true, // Keep this true for security, but let's see if it's a cert issue
    },
  });
  
  const startTime = Date.now();
  const response = await undiciFetch(testUrl, {
    dispatcher: agent,
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    },
  });
  const elapsed = Date.now() - startTime;
  console.log(`✅ Succeeded in ${elapsed}ms`);
  console.log(`   Status: ${response.status} ${response.statusText}`);
} catch (error) {
  console.log(`❌ Failed`);
  console.log(`   Error: ${error.message}`);
  if (error.cause) {
    console.log(`   Cause: ${JSON.stringify(error.cause, null, 2)}`);
  }
}

console.log('\n---\n');

// Test 4: Try with http instead of https (to see if it's TLS-specific)
console.log('Test 4: Try HTTP (non-HTTPS) to check if TLS is the issue');
try {
  const httpUrl = testUrl.replace('https://', 'http://');
  const startTime = Date.now();
  const response = await fetch(httpUrl, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  const elapsed = Date.now() - startTime;
  console.log(`✅ HTTP succeeded in ${elapsed}ms`);
  console.log(`   Status: ${response.status} ${response.statusText}`);
  console.log(`   Final URL: ${response.url}`);
} catch (error) {
  console.log(`❌ HTTP also failed`);
  console.log(`   Error: ${error.message}`);
}

console.log('\n---\n');

// Test 5: Check if it's a Node.js version issue with TLS
console.log('Test 5: Node.js TLS info');
console.log(`   Node version: ${process.version}`);
console.log(`   OpenSSL version: ${process.versions.openssl}`);

