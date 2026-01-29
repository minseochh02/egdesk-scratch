/**
 * Capture ALL Data on Login
 *
 * Goal: Find where timestamp/timing data is sent
 *
 * Captures:
 * 1. All HTTP requests (GET, POST)
 * 2. All WebSocket messages
 * 3. All form fields
 * 4. Everything sent when clicking login button
 */

const { chromium } = require('playwright-core');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function waitForEnter(message) {
  return new Promise((resolve) => {
    rl.question(`\n${message}\nPress ENTER to continue...`, () => {
      resolve();
    });
  });
}

(async () => {
  console.log('🔬 Comprehensive Login Data Capture\n');
  console.log('═'.repeat(70));
  console.log('Goal: Find ALL data sent during login (including timestamps)');
  console.log('═'.repeat(70));
  console.log('');

  const captureLog = {
    httpRequests: [],
    webSocketMessages: [],
    formFields: {},
    loginPOST: null
  };

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({ locale: 'ko-KR' });

  // Hook WebSocket BEFORE page loads
  await context.addInitScript(() => {
    window.__allWSMessages__ = [];

    const OriginalWebSocket = window.WebSocket;

    window.WebSocket = function(url, protocols) {
      const ws = new OriginalWebSocket(url, protocols);

      const originalSend = ws.send;
      ws.send = function(data) {
        const dataStr = typeof data === 'string' ? data : `[Binary: ${data.byteLength} bytes]`;

        window.__allWSMessages__.push({
          direction: 'SENT',
          timestamp: Date.now(),
          url: url,
          data: dataStr,
          dataLength: data?.length || data?.byteLength || 0
        });

        console.log(`📤 WS SENT: ${dataStr.substring(0, 100)}`);

        return originalSend.call(this, data);
      };

      const originalOnMessage = ws.onmessage;
      ws.onmessage = function(event) {
        const dataStr = typeof event.data === 'string' ? event.data : `[Binary: ${event.data.byteLength} bytes]`;

        window.__allWSMessages__.push({
          direction: 'RECEIVED',
          timestamp: Date.now(),
          url: url,
          data: dataStr,
          dataLength: event.data?.length || event.data?.byteLength || 0
        });

        console.log(`📨 WS RECEIVED: ${dataStr.substring(0, 100)}`);

        if (originalOnMessage) {
          return originalOnMessage.call(this, event);
        }
      };

      return ws;
    };
  });

  const page = await context.newPage();

  // Capture ALL HTTP requests
  page.on('request', request => {
    const url = request.url();
    const method = request.method();

    captureLog.httpRequests.push({
      timestamp: Date.now(),
      type: 'REQUEST',
      method: method,
      url: url,
      postData: request.postData()
    });

    if (method === 'POST') {
      console.log(`\n📤 HTTP POST: ${url.split('/').slice(-1)[0]}`);
      if (request.postData()) {
        console.log(`   Data: ${request.postData().substring(0, 100)}...`);
      }
    }
  });

  // Capture ALL HTTP responses
  page.on('response', async response => {
    const url = response.url();
    const method = response.request().method();

    captureLog.httpRequests.push({
      timestamp: Date.now(),
      type: 'RESPONSE',
      method: method,
      url: url,
      status: response.status()
    });

    // Capture login POST specifically
    if (url.includes('CMMServiceMemLoginC.ajax') && method === 'POST') {
      console.log(`\n🎯 LOGIN POST DETECTED!`);

      const postData = response.request().postData();

      try {
        const params = new URLSearchParams(postData);
        const parsed = Object.fromEntries(params.entries());

        captureLog.loginPOST = {
          timestamp: Date.now(),
          url: url,
          postData: postData,
          parsed: parsed,
          responseStatus: response.status()
        };

        console.log(`   Fields: ${Object.keys(parsed).length}`);
        console.log(`   Response status: ${response.status()}`);
      } catch (e) {
        console.log(`   (Could not parse)`);
      }
    }
  });

  // Monitor browser console
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('WS SENT') || text.includes('WS RECEIVED')) {
      console.log(`[Browser] ${text}`);
    }
  });

  console.log('🌐 Navigating to Shinhan Card...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  console.log('');
  console.log('═'.repeat(70));
  console.log('READY TO CAPTURE');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Instructions:');
  console.log('  1. Type password with HARDWARE KEYBOARD');
  console.log('  2. Watch console for WebSocket messages during typing');
  console.log('  3. Click LOGIN button');
  console.log('  4. Watch for all network activity');
  console.log('  5. Press ENTER here when done');
  console.log('');
  console.log('🔍 Monitoring:');
  console.log('   - HTTP POST requests');
  console.log('   - WebSocket messages (to localhost and external)');
  console.log('   - Form field values');
  console.log('');

  await waitForEnter('Complete login attempt, then press ENTER');

  // Capture WebSocket messages
  const wsMessages = await page.evaluate(() => window.__allWSMessages__ || []);
  captureLog.webSocketMessages = wsMessages;

  // Capture final form fields
  const formFields = await page.evaluate(() => {
    const fields = {};
    document.querySelectorAll('input[type="hidden"]').forEach(field => {
      if (field.name) {
        fields[field.name] = {
          value: field.value || '',
          length: field.value?.length || 0
        };
      }
    });
    return fields;
  });

  captureLog.formFields = formFields;

  console.log('');
  console.log('═'.repeat(70));
  console.log('📊 CAPTURE SUMMARY');
  console.log('═'.repeat(70));
  console.log('');

  console.log(`HTTP Requests: ${captureLog.httpRequests.length}`);
  console.log(`WebSocket Messages: ${captureLog.webSocketMessages.length}`);
  console.log(`Form Fields: ${Object.keys(captureLog.formFields).length}`);
  console.log(`Login POST: ${captureLog.loginPOST ? 'Captured ✅' : 'Not captured ❌'}`);
  console.log('');

  if (captureLog.webSocketMessages.length > 0) {
    console.log('🔍 WebSocket Activity:');
    const sent = captureLog.webSocketMessages.filter(m => m.direction === 'SENT');
    const received = captureLog.webSocketMessages.filter(m => m.direction === 'RECEIVED');

    console.log(`   Sent: ${sent.length} messages`);
    console.log(`   Received: ${received.length} messages`);

    // Show recent messages around login time
    if (captureLog.loginPOST) {
      const loginTime = captureLog.loginPOST.timestamp;
      const aroundLogin = captureLog.webSocketMessages.filter(m =>
        Math.abs(m.timestamp - loginTime) < 5000  // Within 5 seconds of login
      );

      if (aroundLogin.length > 0) {
        console.log('');
        console.log(`   🔥 WebSocket messages near login time (±5s):`);
        aroundLogin.forEach(m => {
          const timeDiff = m.timestamp - loginTime;
          console.log(`      ${m.direction} (${timeDiff}ms): ${m.data.substring(0, 80)}...`);
        });
      }
    }
    console.log('');
  }

  if (captureLog.loginPOST) {
    console.log('🎯 Login POST Data:');
    console.log(`   URL: ${captureLog.loginPOST.url}`);
    console.log(`   Fields submitted: ${Object.keys(captureLog.loginPOST.parsed).length}`);
    console.log('');

    // Show key fields
    const keyFields = ['pwd__E2E__', '__E2E_RESULT__', '__E2E_KEYPAD__', '__E2E_UNIQUE__'];
    keyFields.forEach(field => {
      const value = captureLog.loginPOST.parsed[field];
      if (value) {
        console.log(`   ${field}:`);
        console.log(`      Length: ${value.length} chars`);
        console.log(`      Value: ${value.substring(0, 60)}...`);
      }
    });
    console.log('');
  }

  // Save everything
  fs.writeFileSync('complete-login-capture.json', JSON.stringify(captureLog, null, 2));
  console.log('💾 Saved complete capture to: complete-login-capture.json');
  console.log('');

  console.log('═'.repeat(70));
  console.log('🔍 ANALYSIS: Where is the timestamp data?');
  console.log('═'.repeat(70));
  console.log('');

  console.log('Checking for timestamp candidates:');
  console.log('');

  // Check if WebSocket sent timing data
  if (wsMessages.length > 0) {
    console.log('Theory 1: Timestamps sent via WebSocket');
    console.log('   WebSocket messages were sent ✅');
    console.log('   Check complete-login-capture.json to examine content');
    console.log('');
  }

  // Check if __E2E_RESULT__ changes between attempts
  console.log('Theory 2: Timestamps encrypted in __E2E_RESULT__');
  console.log('   __E2E_RESULT__ is 512 chars ✅');
  console.log('   Marked as "static" but might update on login submit');
  console.log('   Compare values across multiple login attempts');
  console.log('');

  console.log('Theory 3: Timestamps in __E2E_KEYPAD__');
  console.log('   __E2E_KEYPAD__ is 512 chars ✅');
  console.log('   Also changes between submissions');
  console.log('');

  console.log('Theory 4: No timestamps sent at all');
  console.log('   Timestamps only for hash generation (anti-replay)');
  console.log('   Server doesn\'t verify timing');
  console.log('');

  await waitForEnter('Press ENTER to close browser');

  await browser.close();
  rl.close();

  process.exit(0);
})();
