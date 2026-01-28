/**
 * Test Focus Activation Theory
 *
 * Theory to validate:
 * 1. Focus on field → WebSocket tells service "Start intercepting"
 * 2. Service activates kernel driver to monitor keyboard
 * 3. User types → Kernel intercepts → Service encrypts → Returns to browser
 * 4. Browser sets pwd__E2E__ field
 *
 * We'll test by separating:
 * - PHASE 1: Focus (no typing) - Control messages
 * - PHASE 2: Typing (after focus) - Data messages
 */

const { chromium } = require('playwright-core');
const fs = require('fs');

async function testFocusActivationTheory() {
  console.log('🔬 Testing Focus Activation Theory');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Theory:');
  console.log('  1. Focus triggers WebSocket "start monitoring" message');
  console.log('  2. Service activates keyboard interception');
  console.log('  3. Typing sends encrypted data back via WebSocket/other');
  console.log('');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({ locale: 'ko-KR' });

  // Comprehensive WebSocket + Field monitoring
  await context.addInitScript(() => {
    window.__testData__ = {
      websocketUrl: null,
      messagesSent: [],
      messagesReceived: [],
      fieldChanges: [],
      phases: []
    };

    // Hook WebSocket
    const OriginalWebSocket = WebSocket;
    window.WebSocket = function(url, protocols) {
      window.__testData__.websocketUrl = url;
      console.log('🔌 WebSocket:', url);

      const ws = new OriginalWebSocket(url, protocols);

      // Hook send
      const originalSend = ws.send;
      ws.send = function(data) {
        window.__testData__.messagesSent.push({
          timestamp: Date.now(),
          data: data,
          length: data?.length || 0,
          phase: window.__currentPhase__ || 'unknown'
        });
        console.log(`📤 [${window.__currentPhase__}] SENT (${data?.length} chars)`);
        return originalSend.call(this, data);
      };

      // Hook onmessage setter
      Object.defineProperty(ws, 'onmessage', {
        set(handler) {
          if (handler) {
            this.addEventListener('message', function(event) {
              window.__testData__.messagesReceived.push({
                timestamp: Date.now(),
                data: event.data,
                length: event.data?.length || 0,
                phase: window.__currentPhase__ || 'unknown'
              });
              console.log(`📨 [${window.__currentPhase__}] RECEIVED (${event.data?.length} chars)`);
              handler.call(this, event);
            });
          }
        },
        configurable: true
      });

      return ws;
    };

    // Hook pwd__E2E__ field
    setTimeout(() => {
      const hookField = () => {
        const field = document.querySelector('input[name="pwd__E2E__"]');
        if (!field) {
          setTimeout(hookField, 100);
          return;
        }

        let value = field.value || '';
        Object.defineProperty(field, 'value', {
          get() { return value; },
          set(newValue) {
            window.__testData__.fieldChanges.push({
              timestamp: Date.now(),
              oldValue: value?.substring(0, 30),
              newValue: newValue?.substring(0, 50),
              phase: window.__currentPhase__ || 'unknown'
            });
            console.log(`🔥 [${window.__currentPhase__}] pwd__E2E__ SET:`, newValue?.substring(0, 40));
            value = newValue;
          },
          configurable: true
        });
        console.log('✅ Field hook installed');
      };
      hookField();
    }, 500);
  });

  const page = await context.newPage();

  console.log('🌐 Navigating to Shinhan Card...');

  await page.evaluate(() => { window.__currentPhase__ = 'PAGE_LOAD'; });

  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  console.log('');
  console.log('═'.repeat(70));
  console.log('📊 BASELINE: Messages after page load (BEFORE focusing)');
  console.log('═'.repeat(70));
  console.log('');

  const baseline = await page.evaluate(() => ({
    sent: (window.__testData__?.messagesSent || []).filter(m => m.phase === 'PAGE_LOAD'),
    received: (window.__testData__?.messagesReceived || []).filter(m => m.phase === 'PAGE_LOAD'),
    totalSent: window.__testData__?.messagesSent.length || 0,
    totalReceived: window.__testData__?.messagesReceived.length || 0
  }));

  console.log(`Page load messages: ${baseline.sent.length} sent, ${baseline.received.length} received`);
  console.log(`Total messages so far: ${baseline.totalSent} sent, ${baseline.totalReceived} received`);
  console.log('');

  if (baseline.sent.length > 0) {
    console.log('ℹ️  WebSocket messages sent during page load:');
    baseline.sent.slice(0, 3).forEach((msg, i) => {
      console.log(`  ${i + 1}. Length: ${msg.length}`);
    });
    console.log('  (These are general initialization, not field-specific)');
    console.log('');
  }

  // ============================================================================
  // PHASE 1: FOCUS (No typing yet!)
  // ============================================================================

  await page.evaluate(() => { window.__currentPhase__ = 'FOCUS'; });

  console.log('═'.repeat(70));
  console.log('🎯 PHASE 1: FOCUS PASSWORD FIELD (Don\'t type yet!)');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Theory: Focus sends "start monitoring" control messages');
  console.log('');
  console.log('Focusing password field...');
  await page.locator('[id="pwd"]').focus();

  console.log('⏳ Waiting 3 seconds for all focus-related messages...');
  await page.waitForTimeout(3000);

  const afterFocus = await page.evaluate(() => ({
    sent: window.__testData__?.messagesSent.filter(m => m.phase === 'FOCUS') || [],
    received: window.__testData__?.messagesReceived.filter(m => m.phase === 'FOCUS') || [],
    fieldChanges: window.__testData__?.fieldChanges.filter(m => m.phase === 'FOCUS') || [],
    totalSent: window.__testData__?.messagesSent.length || 0,
    totalReceived: window.__testData__?.messagesReceived.length || 0
  }));

  console.log('');
  console.log('📊 PHASE 1 RESULTS:');
  console.log(`  Messages SENT: ${afterFocus.sent.length}`);
  console.log(`  Messages RECEIVED: ${afterFocus.received.length}`);
  console.log(`  Field changes: ${afterFocus.fieldChanges.length}`);
  console.log('');

  if (afterFocus.sent.length > 0) {
    console.log('✅ FOCUS triggered WebSocket messages!');
    console.log('');
    console.log('First few focus messages:');
    afterFocus.sent.slice(0, 3).forEach((msg, i) => {
      console.log(`  ${i + 1}. Length: ${msg.length}, Data: ${msg.data.substring(0, 60)}...`);
    });
    console.log('');
    console.log('💡 These are likely CONTROL/INITIALIZATION messages');
    console.log('   Telling service: "Start monitoring keyboard for field #pwd"');
  } else {
    console.log('❌ No messages sent on focus');
    console.log('   Initialization might have happened earlier (page load)');
  }

  console.log('');

  // ============================================================================
  // PHASE 2: TYPING (Single character)
  // ============================================================================

  await page.evaluate(() => { window.__currentPhase__ = 'TYPING'; });

  console.log('═'.repeat(70));
  console.log('🎯 PHASE 2: TYPE ONE CHARACTER');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Theory: Typing sends keystroke data, service returns encrypted value');
  console.log('');
  console.log('INSTRUCTIONS:');
  console.log('1. Type EXACTLY the letter "g"');
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

  const afterTyping = await page.evaluate(() => ({
    sent: window.__testData__?.messagesSent.filter(m => m.phase === 'TYPING') || [],
    received: window.__testData__?.messagesReceived.filter(m => m.phase === 'TYPING') || [],
    fieldChanges: window.__testData__?.fieldChanges.filter(m => m.phase === 'TYPING') || []
  }));

  console.log('');
  console.log('📊 PHASE 2 RESULTS:');
  console.log(`  Messages SENT: ${afterTyping.sent.length}`);
  console.log(`  Messages RECEIVED: ${afterTyping.received.length}`);
  console.log(`  Field changes: ${afterTyping.fieldChanges.length}`);
  console.log('');

  if (afterTyping.sent.length > 0) {
    console.log('📤 Typing triggered WebSocket messages:');
    afterTyping.sent.forEach((msg, i) => {
      console.log(`  ${i + 1}. Length: ${msg.length}, Data: ${msg.data.substring(0, 60)}...`);
    });
    console.log('');
  }

  if (afterTyping.received.length > 0) {
    console.log('📨 RECEIVED RESPONSES:');
    afterTyping.received.forEach((msg, i) => {
      console.log(`  ${i + 1}. Length: ${msg.length}, Data: ${msg.data.substring(0, 100)}`);
      console.log(`      Full: ${msg.data}`);
    });
    console.log('');
  } else {
    console.log('⚠️  No WebSocket responses captured');
    console.log('');
  }

  if (afterTyping.fieldChanges.length > 0) {
    console.log('🔥 pwd__E2E__ field was SET:');
    afterTyping.fieldChanges.forEach((change, i) => {
      console.log(`  ${i + 1}. New value: ${change.newValue}`);
    });
    console.log('');
  }

  // Check final field value
  const finalCheck = await page.evaluate(() => ({
    visible: document.getElementById('pwd')?.value || '',
    pwdE2E: document.querySelector('input[name="pwd__E2E__"]')?.value || null
  }));

  console.log('═'.repeat(70));
  console.log('📊 FINAL STATE:');
  console.log('═'.repeat(70));
  console.log('');
  console.log(`Visible field: "${finalCheck.visible}"`);
  console.log(`pwd__E2E__: ${finalCheck.pwdE2E ? finalCheck.pwdE2E.substring(0, 50) + '...' : '(empty)'}`);
  console.log('');

  // Save all data
  const allData = await page.evaluate(() => window.__testData__);
  allData.finalFields = finalCheck;

  fs.writeFileSync('focus-activation-test-results.json', JSON.stringify(allData, null, 2));

  console.log('═'.repeat(70));
  console.log('🎯 THEORY VALIDATION:');
  console.log('═'.repeat(70));
  console.log('');

  // Validate theory
  const hasFocusMessages = afterFocus.sent.length > 0;
  const hasTypingMessages = afterTyping.sent.length > 0;
  const hasResponses = afterTyping.received.length > 0;
  const fieldWasSet = !!finalCheck.pwdE2E;

  console.log('Your theory states:');
  console.log('  1. Focus → WebSocket control messages');
  console.log(`     Result: ${hasFocusMessages ? '✅ CONFIRMED' : '❌ NOT CONFIRMED'}`);
  console.log('');
  console.log('  2. Service intercepts keyboard');
  console.log('     Result: ⏳ (Assumed - can\'t directly observe)');
  console.log('');
  console.log('  3. Service encrypts and returns to browser');
  console.log(`     Result: ${hasResponses ? '✅ CONFIRMED (captured responses)' : '⚠️ PARTIAL (field set but no responses captured)'}`);
  console.log('');
  console.log('  4. Browser sets pwd__E2E__ field');
  console.log(`     Result: ${fieldWasSet ? '✅ CONFIRMED' : '❌ NOT CONFIRMED'}`);
  console.log('');

  if (fieldWasSet && !hasResponses) {
    console.log('🤔 INTERESTING:');
    console.log('   pwd__E2E__ WAS set, but we didn\'t capture WebSocket response');
    console.log('');
    console.log('   Possibilities:');
    console.log('   A) Response comes via different mechanism (not WebSocket)');
    console.log('   B) Service writes directly to browser memory');
    console.log('   C) Our hook timing is still off');
    console.log('');
  }

  console.log('💾 Full data saved to: focus-activation-test-results.json');
  console.log('');

  console.log('Browser stays open (30s)...');
  await page.waitForTimeout(30000);
  await browser.close();

  console.log('');
  console.log('═'.repeat(70));
  console.log('📋 NEXT STEPS:');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Check focus-activation-test-results.json for:');
  console.log('  1. Focus phase messages (control/initialization)');
  console.log('  2. Typing phase messages (keystroke data)');
  console.log('  3. Any received messages (encrypted responses)');
  console.log('');
  console.log('Compare message counts and formats to understand the protocol!');
  console.log('');
}

testFocusActivationTheory().catch(console.error);
