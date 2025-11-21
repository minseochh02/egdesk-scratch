/**
 * Test with longer timeout to see if quus.cloud is just slow
 */

const testUrl = 'https://quus.cloud';

console.log('Testing quus.cloud with longer timeout...\n');

// Test with 30 second timeout
console.log('Test: Undici fetch with 30s connection timeout');
try {
  const { fetch: undiciFetch, Agent } = await import('undici');
  
  const agent = new Agent({
    connect: {
      timeout: 30000, // 30 seconds
    },
  });
  
  const startTime = Date.now();
  console.log(`Starting fetch at ${new Date().toISOString()}...`);
  
  const response = await undiciFetch(testUrl, {
    dispatcher: agent,
    redirect: 'follow',
    headers: {
      'User-Agent': 'EGDeskContentFetcher/1.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  
  const elapsed = Date.now() - startTime;
  console.log(`✅ Succeeded in ${elapsed}ms`);
  console.log(`   Status: ${response.status} ${response.statusText}`);
  console.log(`   Content-Type: ${response.headers.get('content-type')}`);
} catch (error) {
  console.log(`❌ Failed`);
  console.log(`   Error: ${error.message}`);
  console.log(`   Error name: ${error.name}`);
  if (error.cause) {
    console.log(`   Cause: ${JSON.stringify(error.cause, null, 2)}`);
  }
}
