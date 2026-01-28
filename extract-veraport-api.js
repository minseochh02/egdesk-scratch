/**
 * Veraport API Hunter
 *
 * This script runs IN THE BROWSER (inject via Playwright) to find Veraport's API
 *
 * Usage:
 *   await page.evaluate(fs.readFileSync('extract-veraport-api.js', 'utf8'));
 */

(function() {
  console.log('🔍 Veraport API Hunter Starting...');
  console.log('');

  const findings = {
    globalObjects: [],
    eventListeners: [],
    suspiciousFunctions: [],
    iframes: [],
    postMessageTargets: [],
    formHooks: []
  };

  // 1. Search for Veraport-related global objects
  console.log('1️⃣ Searching for global objects...');
  const globalNames = Object.getOwnPropertyNames(window);
  const veraportRelated = globalNames.filter(name =>
    name.toLowerCase().includes('veraport') ||
    name.toLowerCase().includes('wizvera') ||
    name.toLowerCase().includes('secure') ||
    name.toLowerCase().includes('vguard') ||
    name.toLowerCase().includes('delfino')
  );

  veraportRelated.forEach(name => {
    const obj = window[name];
    findings.globalObjects.push({
      name,
      type: typeof obj,
      properties: typeof obj === 'object' ? Object.keys(obj) : null,
      toString: obj ? obj.toString() : null
    });
    console.log(`  ✅ Found: window.${name}`);
    if (typeof obj === 'object' && obj) {
      console.log(`     Properties: ${Object.keys(obj).join(', ')}`);
    }
  });

  // 2. Check password field for special properties
  console.log('');
  console.log('2️⃣ Analyzing password field...');
  const passwordFields = document.querySelectorAll('input[type="password"]');
  passwordFields.forEach((field, i) => {
    console.log(`  Password field #${i + 1}:`);
    console.log(`    ID: ${field.id}`);
    console.log(`    Classes: ${field.className}`);

    // Check for custom properties
    const customProps = Object.keys(field).filter(key =>
      !key.startsWith('_') &&
      typeof field[key] === 'function' &&
      !['focus', 'blur', 'click'].includes(key)
    );

    if (customProps.length > 0) {
      console.log(`    Custom methods: ${customProps.join(', ')}`);
      findings.suspiciousFunctions.push({
        element: 'password field',
        methods: customProps
      });
    }

    // Check for data attributes
    const dataAttrs = Array.from(field.attributes)
      .filter(attr => attr.name.startsWith('data-'))
      .map(attr => `${attr.name}=${attr.value}`);

    if (dataAttrs.length > 0) {
      console.log(`    Data attributes: ${dataAttrs.join(', ')}`);
    }
  });

  // 3. Search for iframes (security keyboards often use iframes)
  console.log('');
  console.log('3️⃣ Checking for iframes...');
  const iframes = document.querySelectorAll('iframe');
  iframes.forEach((iframe, i) => {
    const src = iframe.src || '(no src)';
    const id = iframe.id || '(no id)';
    console.log(`  Iframe #${i + 1}: ${id} - ${src}`);

    findings.iframes.push({
      id,
      src,
      name: iframe.name,
      visible: iframe.offsetParent !== null
    });

    // Try to access iframe content (may be blocked)
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        console.log(`    ✅ Accessible iframe content`);
        const iframeGlobals = Object.keys(iframe.contentWindow || {});
        console.log(`    Window objects: ${iframeGlobals.slice(0, 10).join(', ')}...`);
      }
    } catch (e) {
      console.log(`    ❌ Cross-origin iframe (blocked)`);
    }
  });

  // 4. Check for event listeners on password fields
  console.log('');
  console.log('4️⃣ Analyzing event listeners...');
  passwordFields.forEach((field, i) => {
    const events = ['keydown', 'keyup', 'keypress', 'input', 'change', 'focus', 'blur'];
    events.forEach(eventType => {
      // Can't directly get listeners, but we can check if they exist
      const hasListener = field[`on${eventType}`] !== null;
      if (hasListener) {
        console.log(`  Password field #${i + 1} has ${eventType} handler`);
        findings.eventListeners.push({
          element: `password field #${i + 1}`,
          event: eventType
        });
      }
    });
  });

  // 5. Check for postMessage usage
  console.log('');
  console.log('5️⃣ Monitoring postMessage...');
  let postMessageCount = 0;
  const originalPostMessage = window.postMessage;
  window.postMessage = function(...args) {
    postMessageCount++;
    console.log(`  postMessage called with:`, args[0]);
    findings.postMessageTargets.push({
      message: JSON.stringify(args[0]),
      origin: args[1]
    });
    return originalPostMessage.apply(this, args);
  };
  console.log(`  postMessage hook installed (count: ${postMessageCount})`);

  // 6. Check form submission handlers
  console.log('');
  console.log('6️⃣ Checking form handlers...');
  const forms = document.querySelectorAll('form');
  forms.forEach((form, i) => {
    console.log(`  Form #${i + 1}:`);
    console.log(`    Action: ${form.action}`);
    console.log(`    Method: ${form.method}`);

    if (form.onsubmit) {
      console.log(`    ✅ Has onsubmit handler`);
      console.log(`    Handler: ${form.onsubmit.toString().substring(0, 100)}...`);
      findings.formHooks.push({
        form: `form #${i + 1}`,
        hasHandler: true
      });
    }
  });

  // 7. Search for suspicious functions in window
  console.log('');
  console.log('7️⃣ Searching for suspicious functions...');
  const suspiciousKeywords = ['password', 'secure', 'encrypt', 'key', 'input', 'veraport', 'keyboard'];
  globalNames.forEach(name => {
    if (typeof window[name] === 'function') {
      const nameLower = name.toLowerCase();
      if (suspiciousKeywords.some(keyword => nameLower.includes(keyword))) {
        console.log(`  ✅ Found function: window.${name}()`);
        findings.suspiciousFunctions.push({
          name,
          signature: window[name].toString().substring(0, 200)
        });
      }
    }
  });

  // 8. Summary
  console.log('');
  console.log('═'.repeat(60));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Global Veraport objects: ${findings.globalObjects.length}`);
  console.log(`Iframes found: ${findings.iframes.length}`);
  console.log(`Event listeners detected: ${findings.eventListeners.length}`);
  console.log(`Suspicious functions: ${findings.suspiciousFunctions.length}`);
  console.log('');

  // 9. Suggest next steps
  console.log('🎯 NEXT STEPS:');
  console.log('');

  if (findings.globalObjects.length > 0) {
    console.log('✅ FOUND GLOBAL OBJECTS!');
    findings.globalObjects.forEach(obj => {
      console.log(`   Try: window.${obj.name}`);
      if (obj.properties) {
        obj.properties.forEach(prop => {
          console.log(`   Try: window.${obj.name}.${prop}(...)`);
        });
      }
    });
  }

  if (findings.iframes.length > 0) {
    console.log('');
    console.log('✅ FOUND IFRAMES - Security keyboard likely in iframe');
    console.log('   Try accessing iframe content or postMessage communication');
  }

  if (findings.suspiciousFunctions.length > 0) {
    console.log('');
    console.log('✅ FOUND SUSPICIOUS FUNCTIONS');
    findings.suspiciousFunctions.forEach(fn => {
      console.log(`   Investigate: window.${fn.name}()`);
    });
  }

  console.log('');
  console.log('💡 TO USE FINDINGS:');
  console.log('   1. Try calling the functions/objects found above');
  console.log('   2. Monitor network traffic when typing password manually');
  console.log('   3. Check iframe communication (postMessage)');
  console.log('   4. Reverse engineer the extension JavaScript files');
  console.log('');

  // Store findings globally for later retrieval
  window.__VERAPORT_FINDINGS__ = findings;
  console.log('💾 Findings saved to: window.__VERAPORT_FINDINGS__');
  console.log('');

  return findings;
})();
