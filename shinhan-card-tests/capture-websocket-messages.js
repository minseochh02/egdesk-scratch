/**
 * Capture Complete WebSocket Communication
 *
 * We found the WebSocket: wss://127.0.0.1:14440/
 * Now let's capture BOTH sent and received messages to understand the protocol!
 */

const { chromium } = require('playwright-core');
const fs = require('fs');

async function captureWebSocketMessages() {
  console.log('📡 WebSocket Message Capture');
  console.log('═'.repeat(70));
  console.log('');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({ locale: 'ko-KR' });

  // Hook WebSocket before page loads
  await context.addInitScript(() => {
    window.__wsMessages__ = {
      sent: [],
      received: [],
      websocket: null
    };

    const OriginalWebSocket = window.WebSocket;

    window.WebSocket = function(url, protocols) {
      const ws = new OriginalWebSocket(url, protocols);

      console.log('🔌 WebSocket created:', url);
      window.__wsMessages__.websocket = {
        url: url,
        createdAt: Date.now()
      };

      // Hook send
      const originalSend = ws.send;
      ws.send = function(data) {
        const message = {
          timestamp: Date.now(),
          data: data,
          dataPreview: typeof data === 'string' ? data.substring(0, 100) : '(binary)',
          dataLength: data?.length || 0
        };

        window.__wsMessages__.sent.push(message);
        console.log('📤 SENT:', message.dataPreview);

        return originalSend.call(this, data);
      };

      // Hook onmessage
      const originalOnMessage = ws.onmessage;
      ws.onmessage = function(event) {
        const message = {
          timestamp: Date.now(),
          data: event.data,
          dataPreview: typeof event.data === 'string' ? event.data.substring(0, 100) : '(binary)',
          dataLength: event.data?.length || 0
        };

        window.__wsMessages__.received.push(message);
        console.log('📨 RECEIVED:', message.dataPreview);

        if (originalOnMessage) {
          return originalOnMessage.call(this, event);
        }
      };

      return ws;
    };
  });

  const page = await context.newPage();

  console.log('🌐 Navigating to Shinhan Card...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  console.log('🎯 Clicking password field...');
  await page.locator('[id="pwd"]').click();
  await page.waitForTimeout(2000);

  console.log('');
  console.log('═'.repeat(70));
  console.log('🧪 TEST: Type EXACTLY the letter "g" and nothing else');
  console.log('═'.repeat(70));
  console.log('');
  console.log('INSTRUCTIONS:');
  console.log('1. Type EXACTLY ONE CHARACTER: the lowercase letter "g"');
  console.log('2. Do NOT type anything else!');
  console.log('3. Wait 2 seconds');
  console.log('4. Press ENTER here');
  console.log('');
  console.log('Why "g" specifically?');
  console.log('  - We know exactly what character was sent');
  console.log('  - Can match request/response pairs');
  console.log('  - Can test if we can replicate it');
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
  console.log('📊 ANALYZING WebSocket TRAFFIC:');
  console.log('');

  const messages = await page.evaluate(() => window.__wsMessages__ || { sent: [], received: [] });

  console.log(`WebSocket: ${messages.websocket?.url || 'Not found'}`);
  console.log('');
  console.log(`Messages SENT: ${messages.sent.length}`);
  console.log(`Messages RECEIVED: ${messages.received.length}`);
  console.log('');

  console.log('═'.repeat(70));
  console.log('📤 SENT MESSAGES:');
  console.log('═'.repeat(70));
  console.log('');

  messages.sent.forEach((msg, i) => {
    console.log(`Message ${i + 1}:`);
    console.log(`  Length: ${msg.dataLength} chars`);
    console.log(`  Data: ${msg.data.substring(0, 120)}...`);
    console.log('');
  });

  console.log('═'.repeat(70));
  console.log('📨 RECEIVED MESSAGES:');
  console.log('═'.repeat(70));
  console.log('');

  if (messages.received.length > 0) {
    messages.received.forEach((msg, i) => {
      console.log(`Response ${i + 1}:`);
      console.log(`  Length: ${msg.dataLength} chars`);
      console.log(`  Data: ${msg.data.substring(0, 120)}...`);
      console.log(`  Full: ${msg.data}`);
      console.log('');
    });
  } else {
    console.log('⚠️  No received messages captured!');
    console.log('   The response might be processed before our hook catches it');
    console.log('   Or responses are binary/encrypted differently');
    console.log('');
  }

  // Check final encrypted value
  const finalE2E = await page.evaluate(() => {
    return document.querySelector('input[name="pwd__E2E__"]')?.value || '(empty)';
  });

  console.log('═'.repeat(70));
  console.log('📊 FINAL RESULTS:');
  console.log('═'.repeat(70));
  console.log('');
  console.log(`pwd__E2E__ field: ${finalE2E.substring(0, 60)}...`);
  console.log('');

  // Save all messages to file for analysis
  const logFile = {
    websocketUrl: messages.websocket?.url,
    timestamp: new Date().toISOString(),
    sentMessages: messages.sent,
    receivedMessages: messages.received,
    finalEncryptedValue: finalE2E
  };

  fs.writeFileSync('websocket-traffic.json', JSON.stringify(logFile, null, 2));
  console.log('💾 All messages saved to: websocket-traffic.json');
  console.log('');

  // Check visible and encrypted fields
  const fieldValues = await page.evaluate(() => {
    return {
      visible: document.getElementById('pwd')?.value || '',
      pwdE2E: document.querySelector('input[name="pwd__E2E__"]')?.value || ''
    };
  });

  console.log('═'.repeat(70));
  console.log('💡 ANALYSIS:');
  console.log('═'.repeat(70));
  console.log('');

  console.log('Test input: ONE character "g"');
  console.log(`Visible field shows: "${fieldValues.visible}"`);
  console.log(`pwd__E2E__ field has: ${fieldValues.pwdE2E ? fieldValues.pwdE2E.substring(0, 50) + '...' : '(empty)'}`);
  console.log('');

  console.log(`Messages exchanged: ${messages.sent.length} sent, ${messages.received.length} received`);
  console.log('');

  if (messages.sent.length === 1 && messages.received.length >= 1) {
    console.log('✅ PERFECT! We have a 1:1 request/response pair!');
    console.log('');
    console.log('Request for character "g":');
    console.log(`  ${messages.sent[0].data}`);
    console.log('');
    console.log('Response (encrypted "g"):');
    console.log(`  ${messages.received[0].data}`);
    console.log('');
    console.log('🎯 If we can craft the request message, we can get encryption for ANY character!');
  } else if (messages.sent.length > 1) {
    console.log('⚠️  Multiple messages sent - you might have typed more than one character');
    console.log(`   Sent: ${messages.sent.length} messages`);
    console.log(`   Received: ${messages.received.length} messages`);
  } else {
    console.log('⚠️  Unexpected message count');
  }

  console.log('');

  if (messages.received.length > 0) {
    console.log('✅ We captured responses from nProtect service!');
    console.log('   These contain the encrypted character values!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Analyze the request message format');
    console.log('  2. Figure out how to craft requests for each character');
    console.log('  3. Send password character-by-character via WebSocket');
    console.log('  4. Build complete pwd__E2E__ value from responses');
    console.log('');
  } else {
    console.log('❌ No response messages captured');
    console.log('');
    console.log('This might mean:');
    console.log('  1. Responses are handled before our hook runs');
    console.log('  2. Need to hook onmessage earlier in the chain');
    console.log('  3. Encryption happens synchronously without WebSocket response');
    console.log('');
  }

  console.log('Browser stays open (60s)...');
  await page.waitForTimeout(60000);
  await browser.close();
}

captureWebSocketMessages().catch(console.error);
