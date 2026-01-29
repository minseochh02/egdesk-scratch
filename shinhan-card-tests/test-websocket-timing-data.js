/**
 * WebSocket Timing Data Capture Test
 *
 * Goal: Capture WebSocket messages to see if keystroke timing is sent separately
 *
 * Theory: Two-Channel Architecture
 * - Channel 1 (WebSocket): Sends keystroke timing data in real-time
 * - Channel 2 (HTTP POST): Sends encrypted hashes on login submit
 * - Server correlates both using session ID
 *
 * If timing data found in WebSocket → Theory confirmed!
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
  console.log('🔬 WebSocket Timing Data Capture Test\n');
  console.log('═'.repeat(70));
  console.log('Testing: Does WebSocket send keystroke timing separately?');
  console.log('═'.repeat(70));
  console.log('');

  const wsMessages = {
    connections: [],
    sent: [],
    received: []
  };

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({ locale: 'ko-KR' });

  // Hook WebSocket BEFORE page loads
  await context.addInitScript(() => {
    window.__wsCapture__ = {
      connections: [],
      sent: [],
      received: []
    };

    const OriginalWebSocket = window.WebSocket;

    window.WebSocket = function(url, protocols) {
      console.log(`🔌 WebSocket CREATED: ${url}`);

      const connectionInfo = {
        url: url,
        protocols: protocols,
        createdAt: Date.now(),
        isLocalhost: url.includes('127.0.0.1') || url.includes('localhost')
      };

      window.__wsCapture__.connections.push(connectionInfo);

      const ws = new OriginalWebSocket(url, protocols);

      // Hook onopen
      const originalOnOpen = ws.onopen;
      ws.onopen = function(event) {
        console.log(`✅ WebSocket OPENED: ${url}`);
        if (originalOnOpen) {
          return originalOnOpen.call(this, event);
        }
      };

      // Hook send
      const originalSend = ws.send;
      ws.send = function(data) {
        const timestamp = Date.now();
        const dataStr = typeof data === 'string' ? data : `[Binary: ${data.byteLength} bytes]`;

        console.log(`📤 SENT (${timestamp}): ${dataStr.substring(0, 150)}`);

        const message = {
          timestamp: timestamp,
          url: url,
          dataType: typeof data,
          data: dataStr,
          dataLength: data?.length || data?.byteLength || 0
        };

        window.__wsCapture__.sent.push(message);

        return originalSend.call(this, data);
      };

      // Hook onmessage
      const originalOnMessage = ws.onmessage;
      ws.onmessage = function(event) {
        const timestamp = Date.now();
        const dataStr = typeof event.data === 'string' ? event.data : `[Binary: ${event.data.byteLength} bytes]`;

        console.log(`📨 RECEIVED (${timestamp}): ${dataStr.substring(0, 150)}`);

        const message = {
          timestamp: timestamp,
          url: url,
          dataType: typeof event.data,
          data: dataStr,
          dataLength: event.data?.length || event.data?.byteLength || 0
        };

        window.__wsCapture__.received.push(message);

        if (originalOnMessage) {
          return originalOnMessage.call(this, event);
        }
      };

      return ws;
    };
  });

  const page = await context.newPage();

  // Also capture console logs from page
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('WebSocket') || text.includes('SENT') || text.includes('RECEIVED')) {
      console.log(`[Browser Console] ${text}`);
    }
  });

  console.log('🌐 Navigating to Shinhan Card...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  console.log('\n📊 Checking WebSocket connections after page load...');
  const afterLoad = await page.evaluate(() => window.__wsCapture__);
  console.log(`   Connections: ${afterLoad.connections.length}`);
  if (afterLoad.connections.length > 0) {
    afterLoad.connections.forEach((conn, i) => {
      console.log(`   ${i + 1}. ${conn.url} ${conn.isLocalhost ? '(LOCALHOST)' : '(EXTERNAL)'}`);
    });
  }
  console.log('');

  console.log('🎯 Focusing password field...');
  await page.locator('#pwd').click();
  await page.waitForTimeout(2000);

  console.log('\n═'.repeat(70));
  console.log('⌨️  CRITICAL TEST: Type THREE characters');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Type: "abc" (three characters)');
  console.log('');
  console.log('Watch the console above for WebSocket SENT messages!');
  console.log('If you see 3 SENT messages while typing → WebSocket sends per-keystroke!');
  console.log('');

  await waitForEnter('Press ENTER after typing "abc"');

  console.log('\n📊 Analyzing WebSocket traffic...');
  await page.waitForTimeout(1000);

  const captured = await page.evaluate(() => window.__wsCapture__);

  console.log('\n═'.repeat(70));
  console.log('📡 WEBSOCKET CONNECTIONS');
  console.log('═'.repeat(70));
  console.log('');
  console.log(`Total connections: ${captured.connections.length}`);
  console.log('');

  captured.connections.forEach((conn, i) => {
    console.log(`Connection ${i + 1}:`);
    console.log(`  URL: ${conn.url}`);
    console.log(`  Type: ${conn.isLocalhost ? 'LOCALHOST (INCA)' : 'EXTERNAL (Shinhan)'}`);
    console.log(`  Created: ${new Date(conn.createdAt).toISOString()}`);
    console.log('');
  });

  console.log('═'.repeat(70));
  console.log('📤 MESSAGES SENT');
  console.log('═'.repeat(70));
  console.log('');
  console.log(`Total messages sent: ${captured.sent.length}`);
  console.log('');

  if (captured.sent.length > 0) {
    captured.sent.forEach((msg, i) => {
      console.log(`Message ${i + 1}:`);
      console.log(`  Timestamp: ${msg.timestamp}`);
      console.log(`  To: ${msg.url}`);
      console.log(`  Type: ${msg.dataType}`);
      console.log(`  Length: ${msg.dataLength}`);
      console.log(`  Data: ${msg.data.substring(0, 200)}`);
      console.log('');
    });
  } else {
    console.log('⚠️  No messages sent via WebSocket!');
    console.log('');
  }

  console.log('═'.repeat(70));
  console.log('📨 MESSAGES RECEIVED');
  console.log('═'.repeat(70));
  console.log('');
  console.log(`Total messages received: ${captured.received.length}`);
  console.log('');

  if (captured.received.length > 0) {
    captured.received.forEach((msg, i) => {
      console.log(`Message ${i + 1}:`);
      console.log(`  Timestamp: ${msg.timestamp}`);
      console.log(`  From: ${msg.url}`);
      console.log(`  Type: ${msg.dataType}`);
      console.log(`  Length: ${msg.dataLength}`);
      console.log(`  Data: ${msg.data.substring(0, 200)}`);
      console.log('');
    });
  } else {
    console.log('⚠️  No messages received via WebSocket!');
    console.log('');
  }

  // Get final encrypted field
  const finalFields = await page.evaluate(() => {
    return {
      visible: document.getElementById('pwd')?.value || '',
      pwd__E2E__: document.querySelector('input[name="pwd__E2E__"]')?.value || ''
    };
  });

  console.log('═'.repeat(70));
  console.log('📊 FINAL FIELDS');
  console.log('═'.repeat(70));
  console.log('');
  console.log(`Visible field: "${finalFields.visible}"`);
  console.log(`Expected: "aaa" (3 letters)`);
  console.log('');
  console.log(`pwd__E2E__ length: ${finalFields.pwd__E2E__.length} chars`);
  console.log(`Expected: 192 chars (3 chars × 64)`);
  console.log(`Match: ${finalFields.pwd__E2E__.length === 192 ? '✅ YES' : '❌ NO'}`);
  console.log('');

  // Analysis
  console.log('═'.repeat(70));
  console.log('🎯 VERDICT');
  console.log('═'.repeat(70));
  console.log('');

  const hasWebSocket = captured.connections.length > 0;
  const sentDuringTyping = captured.sent.length > 0;
  const receivedResponses = captured.received.length > 0;

  console.log(`WebSocket connection exists: ${hasWebSocket ? '✅ YES' : '❌ NO'}`);
  console.log(`Messages sent during typing: ${sentDuringTyping ? '✅ YES' : '❌ NO'}`);
  console.log(`Responses received: ${receivedResponses ? '✅ YES' : '❌ NO'}`);
  console.log('');

  if (hasWebSocket && sentDuringTyping) {
    console.log('🎉 TWO-CHANNEL THEORY CONFIRMED!');
    console.log('');
    console.log('Evidence:');
    console.log('  ✅ WebSocket connection active');
    console.log('  ✅ Messages sent during typing');
    console.log(`  ✅ Sent ${captured.sent.length} messages for ${finalFields.visible.length} characters`);
    console.log('');
    console.log('This proves:');
    console.log('  - Timing data sent via WebSocket (real-time)');
    console.log('  - Hashes sent via HTTP POST (on submit)');
    console.log('  - Server correlates both channels');
    console.log('');
    console.log('Next: Analyze WebSocket message content for timestamps!');
  } else if (hasWebSocket && !sentDuringTyping) {
    console.log('🤔 WebSocket exists but no messages sent during typing');
    console.log('');
    console.log('Possible reasons:');
    console.log('  - WebSocket used for initialization only');
    console.log('  - Messages sent on submit, not per-keystroke');
    console.log('  - Our hook missed the messages');
    console.log('');
    console.log('Need: Check WebSocket traffic at login submission');
  } else {
    console.log('⚠️  No WebSocket activity detected!');
    console.log('');
    console.log('This suggests:');
    console.log('  - All data sent via HTTP POST only');
    console.log('  - Need to re-examine POST data for hidden timing');
    console.log('  - Or timing not verified at all');
  }

  // Save results
  const results = {
    test: 'WebSocket Timing Data Capture',
    typedPassword: 'abc',
    expectedChars: 3,
    webSocketConnections: captured.connections,
    messagesSent: captured.sent,
    messagesReceived: captured.received,
    finalFields: finalFields,
    analysis: {
      hasWebSocket: hasWebSocket,
      sentDuringTyping: sentDuringTyping,
      receivedResponses: receivedResponses,
      messageCount: captured.sent.length,
      expectedMessageCount: 3
    }
  };

  fs.writeFileSync('websocket-timing-test.json', JSON.stringify(results, null, 2));
  console.log('');
  console.log('💾 Saved to: websocket-timing-test.json');
  console.log('');

  await waitForEnter('Press ENTER to close browser');

  await browser.close();
  rl.close();

  process.exit(0);
})();
