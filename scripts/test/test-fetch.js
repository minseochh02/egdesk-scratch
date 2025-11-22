/**
 * Test script to verify if fetch is working
 * Run with: node scripts/test-fetch.js <url>
 */

const testUrl = process.argv[2] || 'https://quus.cloud';

console.log('Testing fetch for:', testUrl);
console.log('---\n');

// Test 1: Native fetch
console.log('Test 1: Native fetch');
try {
  const startTime = Date.now();
  const response = await fetch(testUrl, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'EGDeskContentFetcher/1.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  const elapsed = Date.now() - startTime;
  console.log(`✅ Native fetch succeeded in ${elapsed}ms`);
  console.log(`   Status: ${response.status} ${response.statusText}`);
  console.log(`   Content-Type: ${response.headers.get('content-type')}`);
  console.log(`   Final URL: ${response.url}`);
  
  // Try to read a bit of the body
  const text = await response.text();
  console.log(`   Body length: ${text.length} bytes`);
  console.log(`   First 100 chars: ${text.substring(0, 100)}...`);
} catch (error) {
  console.log('❌ Native fetch failed');
  console.log(`   Error: ${error.message}`);
  console.log(`   Error name: ${error.name}`);
  if (error.cause) {
    console.log(`   Cause: ${JSON.stringify(error.cause, null, 2)}`);
  }
  if (error.code) {
    console.log(`   Code: ${error.code}`);
  }
  console.log(`   Stack: ${error.stack}`);
}

console.log('\n---\n');

// Test 2: Undici fetch
console.log('Test 2: Undici fetch');
try {
  const { fetch: undiciFetch, Agent } = await import('undici');
  const agent = new Agent({
    connect: {
      timeout: 15000,
    },
  });
  
  const startTime = Date.now();
  const response = await undiciFetch(testUrl, {
    dispatcher: agent,
    redirect: 'follow',
    headers: {
      'User-Agent': 'EGDeskContentFetcher/1.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  const elapsed = Date.now() - startTime;
  console.log(`✅ Undici fetch succeeded in ${elapsed}ms`);
  console.log(`   Status: ${response.status} ${response.statusText}`);
  console.log(`   Content-Type: ${response.headers.get('content-type')}`);
  console.log(`   Final URL: ${response.url}`);
  
  // Try to read a bit of the body
  const text = await response.text();
  console.log(`   Body length: ${text.length} bytes`);
  console.log(`   First 100 chars: ${text.substring(0, 100)}...`);
} catch (error) {
  console.log('❌ Undici fetch failed');
  console.log(`   Error: ${error.message}`);
  console.log(`   Error name: ${error.name}`);
  if (error.cause) {
    console.log(`   Cause: ${JSON.stringify(error.cause, null, 2)}`);
  }
  if (error.code) {
    console.log(`   Code: ${error.code}`);
  }
  console.log(`   Stack: ${error.stack}`);
}

console.log('\n---\n');

// Test 3: Simple test with timeout
console.log('Test 3: Native fetch with AbortController (15s timeout)');
try {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  
  const startTime = Date.now();
  const response = await fetch(testUrl, {
    redirect: 'follow',
    signal: controller.signal,
    headers: {
      'User-Agent': 'EGDeskContentFetcher/1.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  const elapsed = Date.now() - startTime;
  clearTimeout(timeout);
  console.log(`✅ Native fetch with timeout succeeded in ${elapsed}ms`);
  console.log(`   Status: ${response.status} ${response.statusText}`);
} catch (error) {
  if (typeof timeout !== 'undefined') {
    clearTimeout(timeout);
  }
  console.log('❌ Native fetch with timeout failed');
  console.log(`   Error: ${error.message}`);
  console.log(`   Error name: ${error.name}`);
  if (error.cause) {
    console.log(`   Cause: ${JSON.stringify(error.cause, null, 2)}`);
  }
  if (error.code) {
    console.log(`   Code: ${error.code}`);
  }
}

