/**
 * Extract INCA nppfs Function
 *
 * Goal: Download nppfs-1.13.0.js and extract the 'ai' function
 *       that processes button clicks
 */

const { chromium } = require('playwright-core');
const fs = require('fs');

(async () => {
  console.log('🔍 Extracting INCA nppfs Function\n');
  console.log('═'.repeat(70));
  console.log('');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false
  });

  const context = await browser.newContext({ locale: 'ko-KR' });
  const page = await context.newPage();

  // Intercept nppfs JavaScript file
  let nppfsCode = null;

  page.on('response', async response => {
    const url = response.url();

    if (url.includes('nppfs-1.13.0.js') || url.includes('nppfs') && url.endsWith('.js')) {
      console.log(`📥 Downloading: ${url}`);

      try {
        nppfsCode = await response.text();
        console.log(`   Size: ${nppfsCode.length} chars`);

        fs.writeFileSync('nppfs-full.js', nppfsCode);
        console.log(`   ✅ Saved to: nppfs-full.js`);
        console.log('');
      } catch (e) {
        console.log(`   ❌ Could not download: ${e.message}`);
      }
    }
  });

  console.log('🌐 Loading Shinhan Card...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(5000);

  if (!nppfsCode) {
    console.log('⚠️  nppfs JavaScript not captured');
    console.log('   Waiting longer...');
    await page.waitForTimeout(5000);
  }

  if (nppfsCode) {
    console.log('═'.repeat(70));
    console.log('📊 CODE ANALYSIS');
    console.log('═'.repeat(70));
    console.log('');

    console.log(`Total size: ${nppfsCode.length} characters`);
    console.log('');

    // Try to find the 'ai' function around line 6021
    const lines = nppfsCode.split('\n');
    console.log(`Total lines: ${lines.length}`);
    console.log('');

    // Extract context around line 6021
    const targetLine = 6021;
    const context = 50;

    if (lines.length >= targetLine) {
      console.log(`Extracting lines ${targetLine - context} to ${targetLine + context}:`);
      console.log('');

      const extractedLines = lines.slice(targetLine - context - 1, targetLine + context);
      const extracted = extractedLines.join('\n');

      fs.writeFileSync('nppfs-function-ai.js', extracted);
      console.log(`✅ Saved to: nppfs-function-ai.js`);
      console.log('');

      // Show preview
      console.log('Preview:');
      console.log('─'.repeat(70));
      console.log(extractedLines.slice(0, 20).join('\n'));
      console.log('...');
      console.log('─'.repeat(70));
      console.log('');
    }

    // Search for common INCA patterns
    console.log('🔍 Searching for key patterns:');
    console.log('');

    const patterns = [
      { name: '__KH_', regex: /__KH_/g },
      { name: 'data:', regex: /data:/g },
      { name: 'function ai', regex: /function ai\(/g },
      { name: 'var ai', regex: /var ai\s*=/g },
      { name: 'setValue', regex: /setValue|setVal|updateValue/g },
      { name: 'hash', regex: /hash/gi }
    ];

    patterns.forEach(pattern => {
      const matches = nppfsCode.match(pattern.regex);
      console.log(`  ${pattern.name}: ${matches ? matches.length : 0} occurrences`);
    });

    console.log('');

    // Try to beautify/analyze the code structure
    console.log('═'.repeat(70));
    console.log('💡 ANALYSIS TIPS');
    console.log('═'.repeat(70));
    console.log('');

    console.log('The code is likely minified. To analyze:');
    console.log('  1. Open nppfs-full.js in a JavaScript beautifier');
    console.log('  2. Search for "function ai" or around line 6021');
    console.log('  3. Look for code that:');
    console.log('     - Extracts hash from action string');
    console.log('     - Processes/transforms the 40-char hash');
    console.log('     - Generates the 96-char value');
    console.log('     - Updates __KH_ field');
    console.log('');

    console.log('Online beautifier: https://beautifier.io/');
    console.log('Or use: npm install -g js-beautify');
    console.log('Then: js-beautify nppfs-full.js > nppfs-beautified.js');
    console.log('');

  } else {
    console.log('❌ nppfs code not captured');
  }

  console.log('Press any key to close...');
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });

  await browser.close();
  rl.close();

  process.exit(0);
})();
