/**
 * Form Submit Monitor
 *
 * Theory: Encryption happens when you submit the form, not when you type.
 * Let's hook the form submission and see what happens!
 */

const { chromium } = require('playwright-core');

async function monitorFormSubmit() {
  console.log('🔍 Form Submit Encryption Monitor');
  console.log('═'.repeat(70));
  console.log('');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({ locale: 'ko-KR' });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const page = await context.newPage();

  console.log('🌐 Navigating to Shinhan Card...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  console.log('🔧 Installing form submission hooks...');
  console.log('');

  // Install hooks BEFORE anything loads
  await page.evaluate(() => {
    window.__submitLogs__ = [];
    window.__encryptionCalled__ = false;

    // Hook form submit
    const forms = document.querySelectorAll('form');
    forms.forEach((form, idx) => {
      const originalSubmit = form.onsubmit;

      form.onsubmit = function(e) {
        window.__submitLogs__.push({
          type: 'FORM_SUBMIT',
          formIndex: idx,
          timestamp: Date.now(),
          action: form.action,
          method: form.method
        });

        // Capture pwd__E2E__ value at submit time
        const pwdE2E = document.querySelector('input[name="pwd__E2E__"]')?.value;
        window.__submitLogs__.push({
          type: 'PWD_E2E_AT_SUBMIT',
          value: pwdE2E?.substring(0, 50)
        });

        // Call original handler if exists
        if (originalSubmit) {
          return originalSubmit.call(this, e);
        }
      };

      window.__submitLogs__.push({
        type: 'HOOK_INSTALLED',
        formIndex: idx
      });
    });

    // Hook addEventListener for forms
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (this.tagName === 'FORM' && type === 'submit') {
        window.__submitLogs__.push({
          type: 'SUBMIT_LISTENER_ADDED',
          tagName: this.tagName,
          id: this.id
        });

        // Wrap listener
        const wrappedListener = function(e) {
          window.__submitLogs__.push({
            type: 'SUBMIT_LISTENER_CALLED',
            timestamp: Date.now()
          });

          return listener.call(this, e);
        };

        return originalAddEventListener.call(this, type, wrappedListener, options);
      }

      return originalAddEventListener.call(this, type, listener, options);
    };

    // Hook login button click
    setTimeout(() => {
      const loginBtn = document.getElementById('loginC');
      if (loginBtn) {
        const originalClick = loginBtn.onclick;

        loginBtn.onclick = function(e) {
          window.__submitLogs__.push({
            type: 'LOGIN_BUTTON_CLICKED',
            timestamp: Date.now(),
            pwdValueBefore: document.getElementById('pwd')?.value,
            pwdE2EBefore: document.querySelector('input[name="pwd__E2E__"]')?.value?.substring(0, 40)
          });

          // Wait a tiny bit and check again
          setTimeout(() => {
            window.__submitLogs__.push({
              type: 'AFTER_CLICK_DELAY',
              pwdValueAfter: document.getElementById('pwd')?.value,
              pwdE2EAfter: document.querySelector('input[name="pwd__E2E__"]')?.value?.substring(0, 40)
            });
          }, 100);

          if (originalClick) {
            return originalClick.call(this, e);
          }
        };

        window.__submitLogs__.push({
          type: 'LOGIN_BUTTON_HOOK_INSTALLED'
        });
      }
    }, 2000);

    console.log('[Hooks installed]');
  });

  console.log('✅ Hooks installed');
  console.log('');

  console.log('═'.repeat(70));
  console.log('🧪 EXPERIMENT: Type password and click login');
  console.log('═'.repeat(70));
  console.log('');
  console.log('INSTRUCTIONS:');
  console.log('1. Fill in your User ID');
  console.log('2. Click password field');
  console.log('3. Type your password manually (use real password!)');
  console.log('4. Click the LOGIN button (let it try to login)');
  console.log('5. Press ENTER here after login attempt');
  console.log('');
  console.log('⚠️  This will attempt a real login!');
  console.log('   We need to see what happens to pwd__E2E__ when you click login');
  console.log('');

  await new Promise(resolve => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    readline.question('Press ENTER after clicking login button: ', () => {
      readline.close();
      resolve();
    });
  });

  console.log('');
  console.log('📝 COLLECTED LOGS:');
  console.log('');

  const logs = await page.evaluate(() => window.__submitLogs__ || []);

  if (logs.length > 0) {
    logs.forEach(log => {
      console.log(`[${log.type}]`);
      Object.entries(log).forEach(([key, value]) => {
        if (key !== 'type') {
          console.log(`  ${key}: ${value}`);
        }
      });
      console.log('');
    });
  } else {
    console.log('❌ No logs captured');
  }

  // Check final state
  const finalState = await page.evaluate(() => {
    return {
      pwdValue: document.getElementById('pwd')?.value,
      pwdE2E: document.querySelector('input[name="pwd__E2E__"]')?.value,
      currentUrl: window.location.href
    };
  });

  console.log('═'.repeat(70));
  console.log('📊 FINAL STATE:');
  console.log('═'.repeat(70));
  console.log('');
  console.log(`Visible field: "${finalState.pwdValue}"`);
  console.log(`pwd__E2E__: ${finalState.pwdE2E ? finalState.pwdE2E.substring(0, 50) + '...' : '(empty)'}`);
  console.log(`Current URL: ${finalState.currentUrl}`);
  console.log('');

  if (finalState.pwdE2E && finalState.pwdE2E !== '(empty)') {
    console.log('✅ pwd__E2E__ WAS SET!');
    console.log('');
    console.log('🎯 Key finding: Encryption happens during login button click');
    console.log('   This means we need to:');
    console.log('   1. Set the masked pattern in visible field');
    console.log('   2. Let the click handler run (it will encrypt)');
    console.log('   3. Or find the handler and call it before clicking');
    console.log('');
  }

  console.log('Browser stays open for manual inspection (60s)...');
  await page.waitForTimeout(60000);

  await browser.close();
}

monitorFormSubmit().catch(console.error);
