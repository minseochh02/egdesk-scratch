/**
 * Inspect Virtual Keypad Event Listeners
 *
 * Goal: Find JavaScript that processes button clicks and hashes
 *
 * What we're looking for:
 * 1. Click event listeners on keypad buttons
 * 2. Functions that extract hash from action
 * 3. Functions that update __KH_ fields
 * 4. How the hash is "decrypted" or processed
 */

const { chromium } = require('playwright-core');
const fs = require('fs');

(async () => {
  console.log('🔍 Inspecting Virtual Keypad Event Listeners\n');
  console.log('═'.repeat(70));
  console.log('');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({ locale: 'ko-KR' });
  const page = await context.newPage();

  // Inject listener hooks BEFORE page loads
  await context.addInitScript(() => {
    window.__listenerLog__ = [];

    // Hook addEventListener
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (type === 'click' || type === 'mousedown' || type === 'mouseup') {
        window.__listenerLog__.push({
          type: type,
          element: this.tagName + (this.id ? '#' + this.id : '') + (this.className ? '.' + this.className.split(' ')[0] : ''),
          listenerString: listener.toString().substring(0, 200)
        });
      }

      return originalAddEventListener.call(this, type, listener, options);
    };

    // Hook onclick setter
    const originalOnClick = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'onclick');
    Object.defineProperty(HTMLElement.prototype, 'onclick', {
      get: function() {
        return originalOnClick.get.call(this);
      },
      set: function(handler) {
        if (handler) {
          window.__listenerLog__.push({
            type: 'onclick',
            element: this.tagName + (this.id ? '#' + this.id : '') + (this.className ? '.' + this.className.split(' ')[0] : ''),
            listenerString: handler.toString().substring(0, 200)
          });
        }
        return originalOnClick.set.call(this, handler);
      }
    });
  });

  console.log('🌐 Navigating to Shinhan Card...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  console.log('🎯 Clicking password field...');
  await page.locator('#pwd').click();
  await page.waitForTimeout(5000);

  // Get all event listeners registered
  const listeners = await page.evaluate(() => window.__listenerLog__ || []);

  console.log('═'.repeat(70));
  console.log('📊 EVENT LISTENERS FOUND');
  console.log('═'.repeat(70));
  console.log('');

  console.log(`Total listeners registered: ${listeners.length}`);
  console.log('');

  // Filter for keypad-related listeners
  const keypadListeners = listeners.filter(l =>
    l.element.includes('kpd') ||
    l.element.includes('keypad') ||
    l.element.includes('nppfs') ||
    l.listenerString.includes('kpd') ||
    l.listenerString.includes('keypad')
  );

  if (keypadListeners.length > 0) {
    console.log(`🔥 Keypad-related listeners: ${keypadListeners.length}`);
    console.log('');

    keypadListeners.forEach((listener, idx) => {
      console.log(`${idx + 1}. ${listener.type} on ${listener.element}`);
      console.log(`   Function preview: ${listener.listenerString}`);
      console.log('');
    });
  } else {
    console.log('⚠️  No keypad-specific listeners found in hook');
    console.log('   Listeners might be attached before our hook ran');
    console.log('');
  }

  // Inspect actual keypad buttons in DOM
  console.log('═'.repeat(70));
  console.log('🔍 INSPECTING KEYPAD BUTTON ELEMENTS');
  console.log('═'.repeat(70));
  console.log('');

  const buttonInfo = await page.evaluate(() => {
    const keypadDiv = document.querySelector('#nppfs-keypad-pwd');

    if (!keypadDiv) {
      return { found: false };
    }

    const buttons = keypadDiv.querySelectorAll('.kpd-button, .kpd-data');
    const info = [];

    buttons.forEach((btn, idx) => {
      if (idx < 5) {  // Sample first 5
        info.push({
          index: idx,
          tagName: btn.tagName,
          className: btn.className,
          hasOnClick: btn.onclick !== null,
          onClickPreview: btn.onclick ? btn.onclick.toString().substring(0, 300) : null,
          dataset: JSON.stringify(btn.dataset),
          attributes: Array.from(btn.attributes).map(a => a.name + '=' + a.value.substring(0, 50))
        });
      }
    });

    return {
      found: true,
      totalButtons: buttons.length,
      sampleButtons: info
    };
  });

  if (buttonInfo.found) {
    console.log(`Found ${buttonInfo.totalButtons} button elements`);
    console.log('');

    if (buttonInfo.sampleButtons.length > 0) {
      console.log('Sample button details:');
      console.log('');

      buttonInfo.sampleButtons.forEach(btn => {
        console.log(`Button ${btn.index}:`);
        console.log(`  Tag: ${btn.tagName}`);
        console.log(`  Class: ${btn.className}`);
        console.log(`  Has onclick: ${btn.hasOnClick}`);

        if (btn.onClickPreview) {
          console.log(`  onclick function:`);
          console.log(`    ${btn.onClickPreview}`);
        }

        console.log(`  Dataset: ${btn.dataset}`);
        console.log('');
      });
    }
  } else {
    console.log('⚠️  Keypad not found in DOM');
  }

  // Look for INCA nProtect JavaScript functions
  console.log('═'.repeat(70));
  console.log('🔍 SEARCHING FOR INCA PROCESSING FUNCTIONS');
  console.log('═'.repeat(70));
  console.log('');

  const incaFunctions = await page.evaluate(() => {
    const functions = [];

    // Check window for nppfs/nProtect functions
    Object.keys(window).forEach(key => {
      if (key.includes('nppfs') || key.includes('npv') || key.includes('nProtect')) {
        const value = window[key];
        if (typeof value === 'function') {
          functions.push({
            name: key,
            code: value.toString().substring(0, 500)
          });
        } else if (typeof value === 'object' && value !== null) {
          functions.push({
            name: key,
            type: 'object',
            keys: Object.keys(value).slice(0, 10)
          });
        }
      }
    });

    return functions;
  });

  if (incaFunctions.length > 0) {
    console.log(`Found ${incaFunctions.length} INCA-related functions/objects:`);
    console.log('');

    incaFunctions.forEach(fn => {
      console.log(`${fn.name}:`);

      if (fn.type === 'object') {
        console.log(`  Type: Object`);
        console.log(`  Keys: ${fn.keys.join(', ')}`);
      } else {
        console.log(`  ${fn.code}`);
      }

      console.log('');
    });
  } else {
    console.log('⚠️  No INCA functions found in window object');
  }

  // Save all findings
  const findings = {
    allListeners: listeners,
    keypadListeners: keypadListeners,
    buttonElements: buttonInfo,
    incaFunctions: incaFunctions
  };

  fs.writeFileSync('keypad-listeners-analysis.json', JSON.stringify(findings, null, 2));
  console.log('💾 Saved analysis to: keypad-listeners-analysis.json');
  console.log('');

  console.log('═'.repeat(70));
  console.log('🎯 NEXT STEPS');
  console.log('═'.repeat(70));
  console.log('');

  console.log('To understand hash processing:');
  console.log('  1. Check keypad-listeners-analysis.json for click handlers');
  console.log('  2. Look at onclick function code');
  console.log('  3. Find function that updates __KH_ field');
  console.log('  4. Reverse engineer the hash processing logic');
  console.log('');

  console.log('Press any key to close...');
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });

  await browser.close();
  process.exit(0);
})();
