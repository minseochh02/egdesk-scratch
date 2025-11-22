/**
 * Test www.quus.cloud directly
 */

const testUrls = [
  'https://quus.cloud',
  'https://www.quus.cloud',
];

for (const testUrl of testUrls) {
  console.log(`\nTesting: ${testUrl}`);
  console.log('---');
  
  try {
    const startTime = Date.now();
    const response = await fetch(testUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      },
    });
    const elapsed = Date.now() - startTime;
    console.log(`✅ Succeeded in ${elapsed}ms`);
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Final URL: ${response.url}`);
    console.log(`   Content-Type: ${response.headers.get('content-type')}`);
  } catch (error) {
    console.log(`❌ Failed`);
    console.log(`   Error: ${error.message}`);
    if (error.cause) {
      console.log(`   Cause code: ${error.cause.code}`);
      console.log(`   Cause name: ${error.cause.name}`);
    }
  }
}

