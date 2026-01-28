/**
 * WebSocket Capture - FIXED VERSION
 *
 * Previous hook ran too late. This hooks at prototype level to catch ALL messages.
 */

const { chromium } = require('playwright-core');
const fs = require('fs');

async function captureWebSocketFixed() {
  console.log('📡 WebSocket Capture (Fixed Hook)');
  console.log('═'.repeat(70));
  console.log('');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({ locale: 'ko-KR' });

  // Hook at EARLIEST possible point
  await context.addInitScript(() => {
    window.__wsCapture__ = {
      sent: [],
      received: [],
      url: null
    };

    // Hook at WebSocket.prototype level (earlier!)
    const OriginalWebSocket = WebSocket;
    const originalSend = WebSocket.prototype.send;

    // Override send at prototype level
    WebSocket.prototype.send = function(data) {
      window.__wsCapture__.sent.push({
        timestamp: Date.now(),
        data: data,
        length: data?.length || 0
      });
      console.log('📤 SENT:', typeof data === 'string' ? data.substring(0, 80) : '(binary)');

      return originalSend.call(this, data);
    };

    // Hook addEventListener for 'message' events
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (this instanceof WebSocket && type === 'message') {
        console.log('🔧 WebSocket message listener being added');

        // Wrap the listener to intercept messages
        const wrappedListener = function(event) {
          window.__wsCapture__.received.push({
            timestamp: Date.now(),
            data: event.data,
            length: event.data?.length || 0
          });
          console.log('📨 RECEIVED:', typeof event.data === 'string' ? event.data.substring(0, 80) : '(binary)');

          // Call original listener
          return listener.call(this, event);
        };

        return originalAddEventListener.call(this, type, wrappedListener, options);
      }

      return originalAddEventListener.call(this, type, listener, options);
    };

    // Also hook the onmessage property setter
    Object.defineProperty(WebSocket.prototype, 'onmessage', {
      set(handler) {
        console.log('🔧 WebSocket onmessage setter called');

        if (handler) {
          const wrappedHandler = function(event) {
            window.__wsCapture__.received.push({
              timestamp: Date.now(),
              data: event.data,
              length: event.data?.length || 0
            });
            console.log('📨 RECEIVED (via setter):', typeof event.data === 'string' ? event.data.substring(0, 80) : '(binary)');

            return handler.call(this, event);
          };

          this.addEventListener('message', wrappedHandler);
        }
      },
      get() {
        // Return null or the actual handler
        return null;
      },
      configurable: true
    });

    console.log('[Early WebSocket Hooks] Installed at prototype level');
  });

  const page = await context.newPage();

  console.log('✅ Early prototype-level hooks installed');
  console.log('');

  console.log('🌐 Navigating to Shinhan Card...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  console.log('🎯 Clicking password field...');
  await page.locator('[id="pwd"]').click();
  await page.waitForTimeout(2000);

  console.log('');
  console.log('═'.repeat(70));
  console.log('🧪 TEST: Type ONLY the letter "g"');
  console.log('═'.repeat(70));
  console.log('');
  console.log('INSTRUCTIONS:');
  console.log('1. Type EXACTLY: lowercase "g"');
  console.log('2. ONE character only!');
  console.log('3. Wait 3 seconds');
  console.log('4. Press ENTER here');
  console.log('');

  await new Promise(resolve => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    readline.question('Press ENTER after typing "g": ', () => {
      readline.close();
      resolve();
    });
  });

  console.log('');
  console.log('📊 CAPTURED TRAFFIC:');
  console.log('');

  const capture = await page.evaluate(() => window.__wsCapture__ || { sent: [], received: [] });

  console.log(`Sent: ${capture.sent.length} messages`);
  console.log(`Received: ${capture.received.length} messages`);
  console.log('');

  if (capture.received.length > 0) {
    console.log('🎉 SUCCESS! We captured responses!');
    console.log('');

    console.log('═'.repeat(70));
    console.log('📨 RECEIVED MESSAGES:');
    console.log('═'.repeat(70));
    console.log('');

    capture.received.forEach((msg, i) => {
      console.log(`Response ${i + 1}:`);
      console.log(`  Length: ${msg.length}`);
      console.log(`  Data: ${msg.data}`);
      console.log('');
    });
  } else {
    console.log('❌ Still no received messages...');
    console.log('');
    console.log('The responses might be:');
    console.log('  1. Processed synchronously (not async)');
    console.log('  2. Coming through a different channel');
    console.log('  3. Handled at native code level');
    console.log('');
  }

  // Check if encryption happened anyway
  const fieldCheck = await page.evaluate(() => {
    return {
      visible: document.getElementById('pwd')?.value || '',
      pwdE2E: document.querySelector('input[name="pwd__E2E__"]')?.value || ''
    };
  });

  console.log('═'.repeat(70));
  console.log('📊 FIELD STATE:');
  console.log('═'.repeat(70));
  console.log('');
  console.log(`Visible: "${fieldCheck.visible}"`);
  console.log(`pwd__E2E__: ${fieldCheck.pwdE2E.substring(0, 60)}...`);
  console.log('');

  if (fieldCheck.pwdE2E && capture.received.length === 0) {
    console.log('🤔 STRANGE: pwd__E2E__ was set but we didn\'t capture WebSocket response!');
    console.log('');
    console.log('This could mean:');
    console.log('  1. Response comes through different mechanism');
    console.log('  2. Encryption happens locally (not via WebSocket)');
    console.log('  3. Our hook timing is still off');
    console.log('');
    console.log('🎯 Alternative theory:');
    console.log('   Maybe the SENT messages already contain encrypted data?');
    console.log('   And nProtect just validates/processes them?');
    console.log('');
  }

  // Save everything
  const logData = {
    timestamp: new Date().toISOString(),
    testChar: 'g',
    sentCount: capture.sent.length,
    receivedCount: capture.received.length,
    sent: capture.sent,
    received: capture.received,
    finalFields: fieldCheck
  };

  fs.writeFileSync('websocket-capture-fixed.json', JSON.stringify(logData, null, 2));
  console.log('💾 Saved to: websocket-capture-fixed.json');
  console.log('');

  console.log('Browser stays open (30s)...');
  await page.waitForTimeout(30000);
  await browser.close();

  return capture;
}

captureWebSocketFixed().catch(console.error);
