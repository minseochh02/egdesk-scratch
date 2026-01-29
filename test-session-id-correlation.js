/**
 * Session ID Correlation Test
 *
 * Goal: Capture initial session ID from Shinhan server and compare with WebSocket ID
 *
 * Theory: The ID passed in WebSocket messages should match the session ID
 *         received from Shinhan during initialization
 *
 * This confirms:
 * - Where session ID comes from (which endpoint)
 * - If WebSocket uses the same session ID
 * - How INCA and Shinhan correlate data
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
  console.log('🔬 Session ID Correlation Test\n');
  console.log('═'.repeat(70));
  console.log('Goal: Track session ID from Shinhan → INCA → WebSocket');
  console.log('═'.repeat(70));
  console.log('');

  const sessionData = {
    receivedFromShinhan: [],
    webSocketConnections: [],
    webSocketMessages: [],
    hiddenFields: {}
  };

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({ locale: 'ko-KR' });

  // Hook WebSocket
  await context.addInitScript(() => {
    window.__sessionTracking__ = {
      wsConnections: [],
      wsMessages: []
    };

    const OriginalWebSocket = window.WebSocket;

    window.WebSocket = function(url, protocols) {
      console.log(`🔌 WebSocket: ${url}`);

      window.__sessionTracking__.wsConnections.push({
        url: url,
        timestamp: Date.now()
      });

      const ws = new OriginalWebSocket(url, protocols);

      const originalSend = ws.send;
      ws.send = function(data) {
        const dataStr = typeof data === 'string' ? data : '[Binary]';

        // Extract ID from message
        const idMatch = dataStr.match(/ID=([a-f0-9]{32})/);
        const id = idMatch ? idMatch[1] : null;

        window.__sessionTracking__.wsMessages.push({
          direction: 'SENT',
          timestamp: Date.now(),
          data: dataStr,
          extractedID: id
        });

        if (id) {
          console.log(`📤 WebSocket SENT with ID: ${id}`);
        }

        return originalSend.call(this, data);
      };

      return ws;
    };
  });

  const page = await context.newPage();

  // Capture page console
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('WebSocket') || text.includes('ID:')) {
      console.log(`[Page] ${text}`);
    }
  });

  // Intercept network responses to find session ID sources
  page.on('response', async response => {
    const url = response.url();
    const request = response.request();
    const method = request.method();

    // Look for POST responses that might contain session data
    if (method === 'POST' && (
      url.includes('nppfs.key.jsp') ||
      url.includes('nppfs.keypad.jsp') ||
      url.includes('ajax')
    )) {
      try {
        const responseText = await response.text();

        // Check if response contains session-like IDs
        const idMatches = responseText.match(/[a-f0-9]{32}/g);

        if (idMatches && idMatches.length > 0) {
          console.log(`\n🔑 Session data from: ${url.split('/').slice(-1)[0]}`);
          console.log(`   Found ${idMatches.length} ID-like values:`);
          idMatches.slice(0, 3).forEach(id => {
            console.log(`   - ${id}`);
          });

          sessionData.receivedFromShinhan.push({
            timestamp: Date.now(),
            url: url,
            endpoint: url.split('/').slice(-1)[0],
            idsFound: idMatches
          });
        }
      } catch (e) {
        // Can't read response body
      }
    }
  });

  console.log('🌐 Navigating to Shinhan Card...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  console.log('\n📸 Capturing initial hidden field values...');

  const initialFields = await page.evaluate(() => {
    const fields = {};
    document.querySelectorAll('input[type="hidden"]').forEach(field => {
      if (field.name && field.value) {
        fields[field.name] = field.value;
      }
    });
    return fields;
  });

  sessionData.hiddenFields = initialFields;

  console.log('\n🔑 Key session fields found:');
  const keyFields = ['__E2E_UNIQUE__', '__E2E_RESULT__', '__KI_pwd'];
  keyFields.forEach(key => {
    if (initialFields[key]) {
      console.log(`   ${key}: ${initialFields[key].substring(0, 40)}...`);
    }
  });
  console.log('');

  console.log('🎯 Focusing password field...');
  await page.locator('#pwd').click();
  await page.waitForTimeout(2000);

  // Check WebSocket connections
  const wsData = await page.evaluate(() => window.__sessionTracking__);
  console.log('\n📡 WebSocket connections:');
  if (wsData.wsConnections.length > 0) {
    wsData.wsConnections.forEach((conn, i) => {
      console.log(`   ${i + 1}. ${conn.url}`);
    });
  } else {
    console.log('   (None yet)');
  }
  console.log('');

  console.log('═'.repeat(70));
  console.log('Type ONE character to trigger WebSocket activity');
  console.log('═'.repeat(70));
  console.log('');

  await waitForEnter('Type "a" then press ENTER here');

  await page.waitForTimeout(2000);

  // Get updated WebSocket data
  const wsDataAfter = await page.evaluate(() => window.__sessionTracking__);

  console.log('\n═'.repeat(70));
  console.log('🔍 CORRELATION ANALYSIS');
  console.log('═'.repeat(70));
  console.log('');

  // Extract IDs from WebSocket messages
  const wsIDs = wsDataAfter.wsMessages
    .filter(m => m.extractedID)
    .map(m => m.extractedID);

  const uniqueWSIDs = [...new Set(wsIDs)];

  console.log('📊 Session IDs found:');
  console.log('');

  console.log('From Shinhan Server (POST responses):');
  if (sessionData.receivedFromShinhan.length > 0) {
    sessionData.receivedFromShinhan.forEach((source, i) => {
      console.log(`   Source ${i + 1}: ${source.endpoint}`);
      source.idsFound.slice(0, 2).forEach(id => {
        console.log(`     - ${id}`);
      });
    });
  } else {
    console.log('   (None captured)');
  }
  console.log('');

  console.log('From Hidden Fields:');
  console.log(`   __E2E_UNIQUE__: ${initialFields['__E2E_UNIQUE__'] || '(not set)'}`);
  console.log('');

  console.log('From WebSocket Messages:');
  if (uniqueWSIDs.length > 0) {
    uniqueWSIDs.forEach(id => {
      console.log(`   - ${id}`);
    });
  } else {
    console.log('   (None found in messages)');
  }
  console.log('');

  // Check if IDs match
  console.log('═'.repeat(70));
  console.log('🎯 CORRELATION CHECK');
  console.log('═'.repeat(70));
  console.log('');

  const e2eUniqueID = initialFields['__E2E_UNIQUE__'];

  if (uniqueWSIDs.length > 0 && e2eUniqueID) {
    console.log(`Hidden field __E2E_UNIQUE__: ${e2eUniqueID}`);
    console.log(`WebSocket ID:                ${uniqueWSIDs[0]}`);
    console.log('');

    const match = uniqueWSIDs.some(wsID => {
      // Check if __E2E_UNIQUE__ is contained in or matches WebSocket ID
      return wsID.includes(e2eUniqueID) || e2eUniqueID.includes(wsID);
    });

    if (match) {
      console.log('✅ IDs MATCH!');
      console.log('');
      console.log('This confirms:');
      console.log('  - Session ID from Shinhan is used in WebSocket');
      console.log('  - INCA and Shinhan use same session identifier');
      console.log('  - Server can correlate WebSocket + HTTP POST data');
      console.log('');
    } else {
      console.log('❌ IDs DO NOT MATCH');
      console.log('');
      console.log('Possible reasons:');
      console.log('  - WebSocket uses different ID format');
      console.log('  - ID is hashed/encoded differently');
      console.log('  - Multiple session IDs for different purposes');
      console.log('');
    }
  } else {
    console.log('⚠️  Could not compare IDs');
    console.log(`   Hidden field: ${e2eUniqueID ? 'Found' : 'Missing'}`);
    console.log(`   WebSocket ID: ${uniqueWSIDs.length > 0 ? 'Found' : 'Missing'}`);
    console.log('');
  }

  // Look for ID in WebSocket message content more carefully
  console.log('═'.repeat(70));
  console.log('🔍 DETAILED WEBSOCKET MESSAGE ANALYSIS');
  console.log('═'.repeat(70));
  console.log('');

  const keystrokeMessages = wsDataAfter.wsMessages.filter(m => {
    // Look for messages that might be keystroke-related
    return m.data.length > 200 && m.direction === 'SENT';
  });

  if (keystrokeMessages.length > 0) {
    console.log(`Found ${keystrokeMessages.length} substantial SENT messages:`);
    console.log('');

    keystrokeMessages.slice(0, 3).forEach((msg, i) => {
      console.log(`Message ${i + 1}:`);
      console.log(`  Length: ${msg.data.length}`);
      console.log(`  Data: ${msg.data.substring(0, 150)}...`);

      // Try to parse the end portion (might have readable data)
      const endPortion = msg.data.substring(msg.data.length - 200);
      if (endPortion.includes('=')) {
        console.log(`  End portion: ...${endPortion}`);
      }
      console.log('');
    });
  }

  // Save everything
  const output = {
    sessionIDsFromShinhan: sessionData.receivedFromShinhan,
    hiddenFields: {
      __E2E_UNIQUE__: initialFields['__E2E_UNIQUE__'],
      __E2E_RESULT__: initialFields['__E2E_RESULT__']?.substring(0, 80) + '...',
      __KI_pwd: initialFields['__KI_pwd']?.substring(0, 80) + '...'
    },
    webSocketConnections: wsDataAfter.wsConnections,
    webSocketMessages: wsDataAfter.wsMessages,
    analysis: {
      websocketIDsFound: uniqueWSIDs,
      hiddenFieldID: e2eUniqueID
    }
  };

  fs.writeFileSync('session-id-correlation.json', JSON.stringify(output, null, 2));
  console.log('💾 Saved to: session-id-correlation.json');
  console.log('');

  await waitForEnter('Press ENTER to close browser');

  await browser.close();
  rl.close();

  process.exit(0);
})();
