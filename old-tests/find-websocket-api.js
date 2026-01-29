/**
 * Find nProtect WebSocket API
 *
 * DISCOVERY: Encryption happens via WebSocket communication!
 * - Browser sends password to local nProtect service
 * - Service encrypts it
 * - Sends back via WebSocket
 * - Browser sets pwd__E2E__ field
 *
 * Let's find this WebSocket and see if we can use it!
 */

const { chromium } = require('playwright-core');

async function findWebSocketAPI() {
  console.log('🔍 nProtect WebSocket API Finder');
  console.log('═'.repeat(70));
  console.log('');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({ locale: 'ko-KR' });

  console.log('🔧 Installing WebSocket monitoring...');

  // Hook WebSocket BEFORE page loads
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });

    // WebSocket monitoring

    window.__websocketLogs__ = [];

    // Hook WebSocket constructor
    const OriginalWebSocket = window.WebSocket;

    window.WebSocket = function(url, protocols) {
      console.log('🔌 WebSocket created:', url);
      window.__websocketLogs__.push({
        type: 'CREATED',
        url: url,
        protocols: protocols,
        timestamp: Date.now()
      });

      const ws = new OriginalWebSocket(url, protocols);
      window.__npWebSocket__ = ws;  // Save reference

      // Hook onopen
      const originalOnOpen = ws.onopen;
      ws.onopen = function(event) {
        console.log('✅ WebSocket opened:', url);
        window.__websocketLogs__.push({
          type: 'OPENED',
          url: url,
          timestamp: Date.now()
        });

        if (originalOnOpen) originalOnOpen.call(this, event);
      };

      // Hook onmessage
      const originalOnMessage = ws.onmessage;
      ws.onmessage = function(event) {
        console.log('📨 WebSocket message received:', event.data?.substring(0, 100));
        window.__websocketLogs__.push({
          type: 'MESSAGE_RECEIVED',
          data: typeof event.data === 'string' ? event.data : '(binary)',
          timestamp: Date.now()
        });

        if (originalOnMessage) originalOnMessage.call(this, event);
      };

      // Hook send
      const originalSend = ws.send;
      ws.send = function(data) {
        console.log('📤 WebSocket sending:', data?.substring ? data.substring(0, 100) : data);
        window.__websocketLogs__.push({
          type: 'MESSAGE_SENT',
          data: typeof data === 'string' ? data : '(binary)',
          timestamp: Date.now()
        });

        return originalSend.call(this, data);
      };

      return ws;
    };

    console.log('[WebSocket Hook] Installed');
  });

  const page = await context.newPage();

  console.log('✅ WebSocket hooks installed');
  console.log('');

  console.log('🌐 Navigating to Shinhan Card...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  console.log('🎯 Clicking password field...');
  await page.locator('[id="pwd"]').click();
  await page.waitForTimeout(2000);

  console.log('');
  console.log('═'.repeat(70));
  console.log('📊 WebSocket Connections Detected:');
  console.log('═'.repeat(70));
  console.log('');

  const initialLogs = await page.evaluate(() => window.__websocketLogs__ || []);

  if (initialLogs.length > 0) {
    console.log('✅ WebSocket activity detected!');
    console.log('');
    initialLogs.forEach(log => {
      console.log(`[${log.type}]`);
      if (log.url) console.log(`  URL: ${log.url}`);
      if (log.data) console.log(`  Data: ${log.data.substring(0, 100)}`);
      console.log('');
    });
  } else {
    console.log('⚠️  No WebSocket activity yet');
  }

  console.log('═'.repeat(70));
  console.log('🧪 CRITICAL TEST: Type ONE character and watch WebSocket');
  console.log('═'.repeat(70));
  console.log('');
  console.log('INSTRUCTIONS:');
  console.log('1. Type ONE character in the password field (like "T")');
  console.log('2. Wait 2 seconds');
  console.log('3. Press ENTER here');
  console.log('');
  console.log('Watch for WebSocket messages in the output above!');
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
  console.log('📊 FINAL WebSocket LOGS:');
  console.log('');

  const finalLogs = await page.evaluate(() => window.__websocketLogs__ || []);

  if (finalLogs.length > initialLogs.length) {
    console.log('🎉 NEW WebSocket activity detected!');
    console.log('');

    const newLogs = finalLogs.slice(initialLogs.length);
    newLogs.forEach(log => {
      console.log(`[${log.type}]`);
      if (log.url) console.log(`  URL: ${log.url}`);
      if (log.data) {
        console.log(`  Data: ${log.data.substring(0, 200)}`);
        if (log.data.length > 200) console.log(`  ... (${log.data.length} total chars)`);
      }
      console.log('');
    });
  }

  // Get WebSocket details
  const wsDetails = await page.evaluate(() => {
    if (window.__npWebSocket__) {
      return {
        exists: true,
        url: window.__npWebSocket__.url,
        readyState: window.__npWebSocket__.readyState,
        protocol: window.__npWebSocket__.protocol,
        extensions: window.__npWebSocket__.extensions
      };
    }
    return { exists: false };
  });

  console.log('═'.repeat(70));
  console.log('🔌 WebSocket Connection Details:');
  console.log('═'.repeat(70));
  console.log('');

  if (wsDetails.exists) {
    console.log('✅ WebSocket found!');
    console.log(`  URL: ${wsDetails.url}`);
    console.log(`  Ready State: ${wsDetails.readyState} (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)`);
    console.log(`  Protocol: ${wsDetails.protocol || '(none)'}`);
    console.log('');

    console.log('🎯 KEY FINDING:');
    console.log('  The nProtect service runs LOCALLY');
    console.log(`  WebSocket endpoint: ${wsDetails.url}`);
    console.log('  We can potentially communicate with it!');
    console.log('');
  }

  console.log('═'.repeat(70));
  console.log('💡 ANALYSIS:');
  console.log('═'.repeat(70));
  console.log('');
  console.log('How encryption works:');
  console.log('  1. You type a character');
  console.log('  2. Browser sends it to nProtect via WebSocket');
  console.log('  3. nProtect service (veraport.exe) encrypts it');
  console.log('  4. Sends encrypted value back via WebSocket');
  console.log('  5. Browser sets pwd__E2E__ field');
  console.log('');
  console.log('To bypass this, we need to:');
  console.log('  A) Find the WebSocket message format');
  console.log('  B) Send our own messages to nProtect service');
  console.log('  C) Receive encrypted response');
  console.log('  D) Set pwd__E2E__ field ourselves');
  console.log('');

  console.log('Browser stays open (60s)...');
  await page.waitForTimeout(60000);
  await browser.close();
}

findWebSocketAPI().catch(console.error);
