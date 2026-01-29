/**
 * Platform Comparison Test
 *
 * Run this on BOTH Windows and macOS to see what's different!
 *
 * This will detect:
 * - Which security processes exist
 * - Whether WebSocket service runs
 * - Whether encryption happens
 * - What components are Windows-only vs cross-platform
 */

const { chromium } = require('playwright-core');
const { spawn } = require('child_process');

async function comparePlatforms() {
  const platform = process.platform; // 'win32' or 'darwin'

  console.log('🔍 Platform Comparison Test');
  console.log('═'.repeat(70));
  console.log('');
  console.log(`Platform: ${platform} (${platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : 'Other'})`);
  console.log('');

  const results = {
    platform: platform,
    timestamp: new Date().toISOString(),
    securityProcesses: [],
    websocketExists: false,
    websocketUrl: null,
    encryptionHappens: false,
    encryptedFieldValue: null
  };

  // Check for security processes (Windows only)
  if (platform === 'win32') {
    console.log('🔍 Checking for security processes...');

    const processCheck = await new Promise((resolve) => {
      const proc = spawn('tasklist', []);
      let output = '';

      proc.stdout.on('data', (data) => { output += data.toString(); });
      proc.on('close', () => resolve(output));
      proc.on('error', () => resolve(''));
    });

    const securityKeywords = [
      'veraport', 'wizvera', 'nprotect', 'npk', 'touchenc',
      'ipin', 'I3GProc', 'delfino', 'TKFWVT'
    ];

    securityKeywords.forEach(keyword => {
      if (processCheck.toLowerCase().includes(keyword.toLowerCase())) {
        results.securityProcesses.push(keyword);
        console.log(`  ✅ Found: ${keyword}`);
      }
    });

    if (results.securityProcesses.length === 0) {
      console.log('  ❌ No security processes detected');
    }
  } else {
    console.log('⏭️  Skipping process check (not Windows)');
  }

  console.log('');

  // Test browser behavior
  console.log('🌐 Testing browser behavior...');
  console.log('');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({ locale: 'ko-KR' });

  // Hook WebSocket to detect if service exists
  await context.addInitScript(() => {
    window.__wsDetected__ = false;
    window.__wsUrl__ = null;

    const OriginalWebSocket = WebSocket;
    window.WebSocket = function(url, protocols) {
      console.log('🔌 WebSocket created:', url);
      window.__wsDetected__ = true;
      window.__wsUrl__ = url;
      return new OriginalWebSocket(url, protocols);
    };
  });

  const page = await context.newPage();

  console.log('📍 Navigating to Shinhan Card...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  // Check if WebSocket was created
  const wsCheck = await page.evaluate(() => ({
    detected: window.__wsDetected__,
    url: window.__wsUrl__
  }));

  results.websocketExists = wsCheck.detected;
  results.websocketUrl = wsCheck.url;

  console.log(`WebSocket service: ${wsCheck.detected ? '✅ EXISTS' : '❌ NOT FOUND'}`);
  if (wsCheck.url) {
    console.log(`  URL: ${wsCheck.url}`);
  }
  console.log('');

  console.log('🎯 Clicking password field...');
  await page.locator('[id="pwd"]').click();
  await page.waitForTimeout(2000);

  console.log('');
  console.log('═'.repeat(70));
  console.log('🧪 TEST: Type "g" and check if encryption happens');
  console.log('═'.repeat(70));
  console.log('');
  console.log('INSTRUCTIONS:');
  console.log('1. Type EXACTLY the letter "g"');
  console.log('2. Wait 2 seconds');
  console.log('3. Press ENTER here');
  console.log('');

  await new Promise(resolve => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    readline.question('Press ENTER after typing: ', () => {
      readline.close();
      resolve();
    });
  });

  console.log('');
  console.log('🔍 Checking encryption...');

  const fieldCheck = await page.evaluate(() => {
    return {
      visible: document.getElementById('pwd')?.value || '',
      pwdE2E: document.querySelector('input[name="pwd__E2E__"]')?.value || null
    };
  });

  results.encryptionHappens = !!fieldCheck.pwdE2E;
  results.encryptedFieldValue = fieldCheck.pwdE2E;

  console.log(`Visible field: "${fieldCheck.visible}"`);
  console.log(`pwd__E2E__: ${fieldCheck.pwdE2E ? fieldCheck.pwdE2E.substring(0, 50) + '...' : '(empty)'}`);
  console.log(`Encryption happened: ${results.encryptionHappens ? '✅ YES' : '❌ NO'}`);
  console.log('');

  await browser.close();

  // Save results
  const fs = require('fs');
  const filename = `platform-test-${platform}.json`;
  fs.writeFileSync(filename, JSON.stringify(results, null, 2));

  console.log('═'.repeat(70));
  console.log('📊 RESULTS SUMMARY:');
  console.log('═'.repeat(70));
  console.log('');
  console.log(`Platform: ${platform}`);
  console.log(`Security processes: ${results.securityProcesses.length > 0 ? results.securityProcesses.join(', ') : 'None'}`);
  console.log(`WebSocket service: ${results.websocketExists ? 'EXISTS' : 'NOT FOUND'}`);
  console.log(`Encryption works: ${results.encryptionHappens ? 'YES' : 'NO'}`);
  console.log('');
  console.log(`💾 Results saved to: ${filename}`);
  console.log('');

  if (platform === 'win32') {
    console.log('📋 Next: Run this same script on macOS');
    console.log('   Then compare the two JSON files!');
  } else if (platform === 'darwin') {
    console.log('📋 Next: Compare with Windows results');
    console.log('   Differences will show what kernel driver does!');
  }

  console.log('');
}

comparePlatforms().catch(console.error);
