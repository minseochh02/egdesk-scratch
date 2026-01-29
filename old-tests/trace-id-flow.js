/**
 * Trace ID Flow
 *
 * Goal: Follow the ID parameter from Shinhan server → WebSocket
 *
 * Flow we're testing:
 * 1. Shinhan sends ID in POST response (nppfs.key.jsp or nppfs.keypad.jsp)
 * 2. Browser stores it somewhere
 * 3. WebSocket sends it back (ID=fd0750...)
 * 4. Server uses it to correlate data
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
  console.log('🔬 Trace ID Flow from Shinhan → WebSocket\n');
  console.log('═'.repeat(70));
  console.log('');

  const trace = {
    shinhanResponses: [],
    webSocketMessages: [],
    extractedIDs: {
      fromShinhan: [],
      fromWebSocket: [],
      fromHiddenFields: {}
    }
  };

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({ locale: 'ko-KR' });

  // Hook WebSocket
  await context.addInitScript(() => {
    window.__idTrace__ = {
      wsMessages: []
    };

    const OriginalWebSocket = window.WebSocket;

    window.WebSocket = function(url, protocols) {
      const ws = new OriginalWebSocket(url, protocols);

      const originalSend = ws.send;
      ws.send = function(data) {
        const dataStr = typeof data === 'string' ? data : '[Binary]';

        window.__idTrace__.wsMessages.push({
          timestamp: Date.now(),
          data: dataStr
        });

        return originalSend.call(this, data);
      };

      return ws;
    };
  });

  const page = await context.newPage();

  // Capture POST responses from Shinhan
  page.on('response', async response => {
    const url = response.url();
    const request = response.request();
    const method = request.method();

    // Focus on key initialization endpoints
    if (method === 'POST' && (
      url.includes('nppfs.key.jsp') ||
      url.includes('nppfs.keypad.jsp')
    )) {
      console.log(`\n📡 POST Response from: ${url.split('/').slice(-1)[0]}`);

      try {
        const responseText = await response.text();
        const postData = request.postData();

        console.log(`   Request data: ${postData?.substring(0, 100)}`);
        console.log(`   Response length: ${responseText.length} bytes`);

        // Extract any ID-like values (32 hex chars)
        const ids = responseText.match(/[a-f0-9]{32}/g) || [];

        if (ids.length > 0) {
          console.log(`   🔑 Found ${ids.length} ID(s):`);
          ids.slice(0, 3).forEach(id => {
            console.log(`      - ${id}`);

            trace.extractedIDs.fromShinhan.push({
              source: url.split('/').slice(-1)[0],
              id: id,
              timestamp: Date.now()
            });
          });
        }

        trace.shinhanResponses.push({
          url: url,
          endpoint: url.split('/').slice(-1)[0],
          postData: postData,
          responseText: responseText.substring(0, 500),
          responseFull: responseText,
          idsFound: ids
        });

      } catch (e) {
        console.log(`   (Could not read response)`);
      }
    }
  });

  console.log('🌐 Navigating to Shinhan Card...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(5000);

  console.log('\n🎯 Focusing password field...');
  await page.locator('#pwd').click();
  await page.waitForTimeout(2000);

  // Capture hidden fields
  const hiddenFields = await page.evaluate(() => {
    const fields = {};
    document.querySelectorAll('input[type="hidden"]').forEach(field => {
      if (field.name && field.value) {
        fields[field.name] = field.value;
      }
    });
    return fields;
  });

  trace.extractedIDs.fromHiddenFields = hiddenFields;

  console.log('\n📋 Hidden field IDs:');
  console.log(`   __E2E_UNIQUE__: ${hiddenFields['__E2E_UNIQUE__']}`);
  console.log('');

  console.log('═'.repeat(70));
  console.log('Type one character to trigger WebSocket messages');
  console.log('═'.repeat(70));
  console.log('');

  await waitForEnter('Type "a" then press ENTER');

  await page.waitForTimeout(2000);

  // Get WebSocket messages
  const wsData = await page.evaluate(() => window.__idTrace__.wsMessages);

  trace.webSocketMessages = wsData;

  // Extract IDs from WebSocket messages
  wsData.forEach(msg => {
    const idMatch = msg.data.match(/ID=([a-f0-9]{32})/);
    if (idMatch) {
      trace.extractedIDs.fromWebSocket.push({
        id: idMatch[1],
        timestamp: msg.timestamp,
        fullMessage: msg.data.substring(msg.data.length - 150)  // Last 150 chars
      });
    }
  });

  console.log('\n═'.repeat(70));
  console.log('🔍 ID CORRELATION ANALYSIS');
  console.log('═'.repeat(70));
  console.log('');

  console.log('IDs from Shinhan Server POST responses:');
  if (trace.extractedIDs.fromShinhan.length > 0) {
    trace.extractedIDs.fromShinhan.forEach((entry, i) => {
      console.log(`   ${i + 1}. ${entry.id} (from ${entry.source})`);
    });
  } else {
    console.log('   (None found)');
  }
  console.log('');

  console.log('IDs from WebSocket Messages:');
  if (trace.extractedIDs.fromWebSocket.length > 0) {
    const uniqueWSIDs = [...new Set(trace.extractedIDs.fromWebSocket.map(e => e.id))];
    uniqueWSIDs.forEach(id => {
      console.log(`   - ${id}`);
    });
  } else {
    console.log('   (None found)');
  }
  console.log('');

  console.log('ID from Hidden Field __E2E_UNIQUE__:');
  console.log(`   ${hiddenFields['__E2E_UNIQUE__']}`);
  console.log('');

  // Cross-reference
  console.log('═'.repeat(70));
  console.log('🎯 CROSS-REFERENCE');
  console.log('═'.repeat(70));
  console.log('');

  if (trace.extractedIDs.fromWebSocket.length > 0 && trace.extractedIDs.fromShinhan.length > 0) {
    const wsID = trace.extractedIDs.fromWebSocket[0].id;
    const shinhanIDs = trace.extractedIDs.fromShinhan.map(e => e.id);

    const found = shinhanIDs.find(id => id === wsID);

    if (found) {
      console.log('✅ MATCH FOUND!');
      console.log('');
      console.log(`WebSocket ID: ${wsID}`);
      console.log(`Came from: ${trace.extractedIDs.fromShinhan.find(e => e.id === found).source}`);
      console.log('');
      console.log('This proves:');
      console.log('  1. Shinhan sends ID in POST response');
      console.log('  2. Browser/INCA uses that ID in WebSocket');
      console.log('  3. Server can correlate both channels using this ID');
      console.log('  4. Two-channel architecture confirmed!');
    } else {
      console.log('❌ NO DIRECT MATCH');
      console.log('');
      console.log(`WebSocket ID:  ${wsID}`);
      console.log(`Shinhan IDs:   ${shinhanIDs.join(', ')}`);
      console.log('');
      console.log('These IDs are different - need to understand relationship');
    }
  } else {
    console.log('⚠️  Insufficient data to cross-reference');
  }

  // Save trace
  fs.writeFileSync('id-flow-trace.json', JSON.stringify(trace, null, 2));
  console.log('');
  console.log('💾 Saved complete trace to: id-flow-trace.json');
  console.log('');

  await waitForEnter('Press ENTER to close browser');

  await browser.close();
  rl.close();

  process.exit(0);
})();
