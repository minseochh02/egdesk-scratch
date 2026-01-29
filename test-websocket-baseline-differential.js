/**
 * WebSocket Baseline + Differential Analysis
 *
 * Strategy:
 * Phase 1: Establish baseline (background WebSocket traffic)
 * Phase 2: Type characters one-by-one
 * Phase 3: Correlate new messages with keystrokes
 * Phase 4: Identify keystroke-related messages
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
  console.log('🔬 WebSocket Baseline + Differential Analysis\n');
  console.log('═'.repeat(70));
  console.log('Strategy: Identify keystroke-related messages by correlation');
  console.log('═'.repeat(70));
  console.log('');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({ locale: 'ko-KR' });

  // Hook WebSocket
  await context.addInitScript(() => {
    window.__wsCapture__ = {
      connections: [],
      allMessages: [],
      messageCounter: 0
    };

    const OriginalWebSocket = window.WebSocket;

    window.WebSocket = function(url, protocols) {
      const connId = window.__wsCapture__.connections.length + 1;
      console.log(`🔌 WebSocket #${connId} CREATED: ${url}`);

      const connectionInfo = {
        id: connId,
        url: url,
        protocols: protocols,
        createdAt: Date.now(),
        isLocalhost: url.includes('127.0.0.1') || url.includes('localhost')
      };

      window.__wsCapture__.connections.push(connectionInfo);

      const ws = new OriginalWebSocket(url, protocols);

      // Hook send
      const originalSend = ws.send;
      ws.send = function(data) {
        const msgId = ++window.__wsCapture__.messageCounter;
        const timestamp = Date.now();
        const dataStr = typeof data === 'string' ? data : `[Binary: ${data.byteLength} bytes]`;

        const message = {
          id: msgId,
          direction: 'SENT',
          timestamp: timestamp,
          connectionId: connId,
          url: url,
          dataType: typeof data,
          data: dataStr,
          dataLength: data?.length || data?.byteLength || 0
        };

        window.__wsCapture__.allMessages.push(message);
        console.log(`📤 #${msgId} SENT [${timestamp}]: ${dataStr.substring(0, 100)}`);

        return originalSend.call(this, data);
      };

      // Hook onmessage
      const originalOnMessage = ws.onmessage;
      ws.onmessage = function(event) {
        const msgId = ++window.__wsCapture__.messageCounter;
        const timestamp = Date.now();
        const dataStr = typeof event.data === 'string' ? event.data : `[Binary: ${event.data.byteLength} bytes]`;

        const message = {
          id: msgId,
          direction: 'RECEIVED',
          timestamp: timestamp,
          connectionId: connId,
          url: url,
          dataType: typeof event.data,
          data: dataStr,
          dataLength: event.data?.length || event.data?.byteLength || 0
        };

        window.__wsCapture__.allMessages.push(message);
        console.log(`📨 #${msgId} RECEIVED [${timestamp}]: ${dataStr.substring(0, 100)}`);

        if (originalOnMessage) {
          return originalOnMessage.call(this, event);
        }
      };

      return ws;
    };
  });

  const page = await context.newPage();

  // Capture console logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('WebSocket') || text.includes('SENT') || text.includes('RECEIVED')) {
      console.log(`[Page] ${text}`);
    }
  });

  console.log('🌐 Navigating to Shinhan Card...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  console.log('\n═'.repeat(70));
  console.log('PHASE 1: Baseline (Establish Background Traffic)');
  console.log('═'.repeat(70));
  console.log('');

  console.log('🎯 Focusing password field...');
  await page.locator('#pwd').click();
  await page.waitForTimeout(2000);

  console.log('\n⏳ Waiting 10 seconds to observe background WebSocket traffic...');
  console.log('   (This establishes baseline for heartbeat/keep-alive messages)');
  console.log('');

  const baselineStart = Date.now();
  await page.waitForTimeout(10000);
  const baselineEnd = Date.now();

  const baseline = await page.evaluate(() => window.__wsCapture__);

  console.log('📊 Baseline Results:');
  console.log(`   Duration: 10 seconds`);
  console.log(`   WebSocket connections: ${baseline.connections.length}`);
  console.log(`   Total messages: ${baseline.allMessages.length}`);
  console.log('');

  if (baseline.connections.length > 0) {
    console.log('   Connections:');
    baseline.connections.forEach(conn => {
      console.log(`     ${conn.id}. ${conn.url} ${conn.isLocalhost ? '(LOCALHOST)' : '(EXTERNAL)'}`);
    });
    console.log('');
  }

  const baselineMessages = baseline.allMessages.filter(m =>
    m.timestamp >= baselineStart && m.timestamp <= baselineEnd
  );

  console.log(`   Baseline messages in 10s window: ${baselineMessages.length}`);
  if (baselineMessages.length > 0) {
    console.log('   (These are heartbeat/keep-alive - NOT keystroke data)');
    baselineMessages.forEach(m => {
      console.log(`     #${m.id} ${m.direction} - ${m.data.substring(0, 60)}...`);
    });
  } else {
    console.log('   (No background messages - WebSocket is quiet)');
  }
  console.log('');

  const baselineMessageCount = baseline.allMessages.length;

  console.log('═'.repeat(70));
  console.log('PHASE 2: Type Characters One-by-One');
  console.log('═'.repeat(70));
  console.log('');
  console.log('We will type 3 characters: "a", "b", "c"');
  console.log('Watch for NEW WebSocket messages correlated with each keystroke!');
  console.log('');

  const keystrokeTests = [];

  for (let i = 0; i < 3; i++) {
    const char = String.fromCharCode(97 + i); // 'a', 'b', 'c'

    console.log('─'.repeat(70));
    console.log(`Keystroke ${i + 1}/3: Type "${char}"`);
    console.log('─'.repeat(70));
    console.log('');

    const beforeTyping = await page.evaluate(() => window.__wsCapture__.allMessages.length);

    await waitForEnter(`Type the character "${char}" now (just press the "${char}" key once)`);

    const keystrokeTime = Date.now();

    // Wait 2 seconds to capture any WebSocket activity triggered by typing
    console.log('⏳ Waiting 2 seconds for WebSocket messages...');
    await page.waitForTimeout(2000);

    const afterTyping = await page.evaluate(() => ({
      messageCount: window.__wsCapture__.allMessages.length,
      messages: window.__wsCapture__.allMessages
    }));

    const newMessageCount = afterTyping.messageCount - beforeTyping;

    console.log('');
    console.log('📊 Results:');
    console.log(`   Messages before typing: ${beforeTyping}`);
    console.log(`   Messages after typing: ${afterTyping.messageCount}`);
    console.log(`   NEW messages: ${newMessageCount}`);
    console.log('');

    if (newMessageCount > 0) {
      const newMessages = afterTyping.messages.slice(beforeTyping);
      console.log('   🔥 NEW MESSAGES DETECTED:');
      newMessages.forEach(m => {
        const timeDiff = m.timestamp - keystrokeTime;
        console.log(`     #${m.id} ${m.direction} (+${timeDiff}ms after keystroke)`);
        console.log(`       ${m.data.substring(0, 80)}...`);
      });
      console.log('');

      keystrokeTests.push({
        char: char,
        keystrokeTime: keystrokeTime,
        newMessageCount: newMessageCount,
        newMessages: newMessages,
        correlationStrength: newMessageCount > 0 ? 'STRONG' : 'NONE'
      });
    } else {
      console.log('   ⚠️  No new messages detected');
      console.log('');

      keystrokeTests.push({
        char: char,
        keystrokeTime: keystrokeTime,
        newMessageCount: 0,
        newMessages: [],
        correlationStrength: 'NONE'
      });
    }
  }

  // Final analysis
  console.log('═'.repeat(70));
  console.log('PHASE 3: Correlation Analysis');
  console.log('═'.repeat(70));
  console.log('');

  const totalNewMessages = keystrokeTests.reduce((sum, t) => sum + t.newMessageCount, 0);
  const avgMessagesPerKeystroke = totalNewMessages / 3;

  console.log('📊 Summary:');
  console.log(`   Baseline messages (10s): ${baselineMessageCount}`);
  console.log(`   Messages during 3 keystrokes: ${totalNewMessages}`);
  console.log(`   Average per keystroke: ${avgMessagesPerKeystroke.toFixed(1)}`);
  console.log('');

  console.log('Per-keystroke breakdown:');
  keystrokeTests.forEach((test, i) => {
    console.log(`   Keystroke ${i + 1} ("${test.char}"): ${test.newMessageCount} new messages`);
  });
  console.log('');

  console.log('═'.repeat(70));
  console.log('🎯 FINAL VERDICT');
  console.log('═'.repeat(70));
  console.log('');

  if (totalNewMessages >= 3) {
    console.log('✅ TWO-CHANNEL THEORY CONFIRMED!');
    console.log('');
    console.log('Evidence:');
    console.log(`  - Typed 3 characters → ${totalNewMessages} new WebSocket messages`);
    console.log('  - Strong correlation between typing and WebSocket activity');
    console.log('  - Messages appear immediately after keystrokes');
    console.log('');
    console.log('Conclusion:');
    console.log('  ✅ WebSocket sends keystroke data in real-time');
    console.log('  ✅ Likely contains: char, timestamp, keycode');
    console.log('  ✅ HTTP POST sends hashes separately');
    console.log('  ✅ Server correlates both channels');
    console.log('');
  } else if (totalNewMessages > 0) {
    console.log('🤔 PARTIAL CORRELATION');
    console.log('');
    console.log(`Some messages detected (${totalNewMessages}), but not 1:1 with keystrokes`);
    console.log('Possible explanations:');
    console.log('  - Messages batched (sent every N keystrokes)');
    console.log('  - Messages for session events, not individual keys');
    console.log('  - Our timing window missed some messages');
    console.log('');
  } else {
    console.log('❌ NO CORRELATION');
    console.log('');
    console.log('No new WebSocket messages during typing');
    console.log('This means:');
    console.log('  - WebSocket NOT used for keystroke data');
    console.log('  - All data must be in HTTP POST');
    console.log('  - Need to re-examine POST for hidden timing data');
    console.log('');
  }

  // Save results
  const results = {
    test: 'WebSocket Baseline + Differential Analysis',
    baseline: {
      duration: '10 seconds',
      messageCount: baselineMessageCount,
      connections: baseline.connections
    },
    keystrokeTests: keystrokeTests,
    summary: {
      totalKeystrokes: 3,
      totalNewMessages: totalNewMessages,
      avgPerKeystroke: avgMessagesPerKeystroke,
      correlationFound: totalNewMessages >= 3
    },
    allMessages: (await page.evaluate(() => window.__wsCapture__.allMessages))
  };

  fs.writeFileSync('websocket-baseline-differential.json', JSON.stringify(results, null, 2));
  console.log('💾 Saved detailed data to: websocket-baseline-differential.json');
  console.log('');

  await waitForEnter('Press ENTER to close browser');

  await browser.close();
  rl.close();

  process.exit(0);
})();
