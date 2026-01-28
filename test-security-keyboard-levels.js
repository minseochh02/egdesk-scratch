/**
 * Security Keyboard Monitoring Level Test Suite
 *
 * This script systematically tests different keyboard input methods to determine
 * at what level Shinhan Card's security keyboard monitors and blocks input.
 *
 * Test Levels:
 * 1. Browser API (Playwright keyboard) - Most detectable
 * 2. JavaScript DOM Events - Medium detectable
 * 3. Direct value manipulation - Least realistic
 * 4. OS-level input (Python pynput) - Most realistic
 *
 * Run: node test-security-keyboard-levels.js
 */

const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const path = require('path');

const TEST_CONFIG = {
  url: 'https://www.shinhancard.com',
  testPassword: 'Test1234!',
  headless: false,
  timeout: 60000
};

// Test results collector
const results = {
  tests: [],
  summary: {}
};

/**
 * Test 1: Playwright Standard Keyboard API
 */
async function testPlaywrightKeyboard(page, field) {
  console.log('\n📋 Test 1: Playwright Keyboard API (page.keyboard.type)');
  console.log('   Level: Browser automation API');
  console.log('   Detection: High (goes through CDP protocol)');

  try {
    await field.focus();
    await page.waitForTimeout(500);
    await field.fill(''); // Clear

    await page.keyboard.type('Test123', { delay: 100 });
    await page.waitForTimeout(500);

    const value = await field.inputValue();
    const success = value.length > 0;

    console.log(`   Result: ${success ? '✅ ACCEPTED' : '❌ BLOCKED'}`);
    console.log(`   Value captured: "${value}" (length: ${value.length})`);

    return {
      method: 'Playwright Keyboard API',
      level: 'Browser Automation API',
      success,
      valueLength: value.length,
      detectionRisk: 'Very High'
    };
  } catch (e) {
    console.log(`   Error: ${e.message}`);
    return { method: 'Playwright Keyboard API', success: false, error: e.message };
  }
}

/**
 * Test 2: Direct Fill Method
 */
async function testDirectFill(page, field) {
  console.log('\n📋 Test 2: Direct Fill (field.fill)');
  console.log('   Level: Browser API direct value setting');
  console.log('   Detection: Very High (bypasses keyboard entirely)');

  try {
    await field.focus();
    await page.waitForTimeout(500);
    await field.fill('Test123');
    await page.waitForTimeout(500);

    const value = await field.inputValue();
    const success = value.length > 0;

    console.log(`   Result: ${success ? '✅ ACCEPTED' : '❌ BLOCKED'}`);
    console.log(`   Value captured: "${value}" (length: ${value.length})`);

    return {
      method: 'Direct Fill',
      level: 'Direct Value Manipulation',
      success,
      valueLength: value.length,
      detectionRisk: 'Very High'
    };
  } catch (e) {
    console.log(`   Error: ${e.message}`);
    return { method: 'Direct Fill', success: false, error: e.message };
  }
}

/**
 * Test 3: JavaScript DOM Events (with isTrusted simulation)
 */
async function testDOMEvents(page, field) {
  console.log('\n📋 Test 3: JavaScript DOM Events');
  console.log('   Level: Browser JavaScript events');
  console.log('   Detection: High (isTrusted will be false)');

  try {
    await field.focus();
    await page.waitForTimeout(500);
    await field.fill(''); // Clear

    await page.evaluate(() => {
      const input = document.activeElement;
      const text = 'Test123';

      for (const char of text) {
        // KeyDown
        const keydown = new KeyboardEvent('keydown', {
          key: char,
          code: `Key${char.toUpperCase()}`,
          keyCode: char.charCodeAt(0),
          bubbles: true,
          cancelable: true,
          composed: true
        });
        input.dispatchEvent(keydown);

        // Input
        const inputEvent = new InputEvent('input', {
          data: char,
          inputType: 'insertText',
          bubbles: true,
          cancelable: true
        });
        input.value += char;
        input.dispatchEvent(inputEvent);

        // KeyUp
        const keyup = new KeyboardEvent('keyup', {
          key: char,
          code: `Key${char.toUpperCase()}`,
          keyCode: char.charCodeAt(0),
          bubbles: true,
          cancelable: true,
          composed: true
        });
        input.dispatchEvent(keyup);
      }
    });

    await page.waitForTimeout(500);
    const value = await field.inputValue();
    const success = value.length > 0;

    console.log(`   Result: ${success ? '✅ ACCEPTED' : '❌ BLOCKED'}`);
    console.log(`   Value captured: "${value}" (length: ${value.length})`);

    return {
      method: 'JavaScript DOM Events',
      level: 'Browser JavaScript',
      success,
      valueLength: value.length,
      detectionRisk: 'High (isTrusted=false)'
    };
  } catch (e) {
    console.log(`   Error: ${e.message}`);
    return { method: 'JavaScript DOM Events', success: false, error: e.message };
  }
}

/**
 * Test 4: Python pynput (OS-level)
 */
async function testPynputOSLevel(page, field) {
  console.log('\n📋 Test 4: Python pynput (OS-level keyboard events)');
  console.log('   Level: Operating System kernel input stack');
  console.log('   Detection: Low (appears as real keyboard)');

  try {
    await field.focus();
    await page.waitForTimeout(500);
    await field.fill(''); // Clear
    await page.waitForTimeout(500);

    console.log('   ⚠️  IMPORTANT: Do NOT touch keyboard/mouse for 5 seconds!');
    await page.waitForTimeout(1000);

    // Try to use Python pynput
    const pythonScript = path.join(__dirname, 'src/main/financehub/utils/virtual-hid-keyboard.py');
    const testText = 'Test123';

    // Use 'python' on Windows, 'python3' on Unix
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

    const pynputSuccess = await new Promise((resolve) => {
      const python = spawn(pythonCmd, [pythonScript, testText, '--delay', '100', '--pre-delay', '500']);

      python.on('close', (code) => resolve(code === 0));
      python.on('error', () => resolve(false));

      setTimeout(() => resolve(false), 10000);
    });

    await page.waitForTimeout(500);
    const value = await field.inputValue();
    const success = value.length > 0;

    console.log(`   Python execution: ${pynputSuccess ? '✅ Success' : '❌ Failed'}`);
    console.log(`   Result: ${success ? '✅ ACCEPTED' : '❌ BLOCKED'}`);
    console.log(`   Value captured: "${value}" (length: ${value.length})`);

    return {
      method: 'Python pynput (OS-level)',
      level: 'OS Kernel Input Stack',
      success,
      valueLength: value.length,
      detectionRisk: 'Low',
      pynputAvailable: pynputSuccess
    };
  } catch (e) {
    console.log(`   Error: ${e.message}`);
    return { method: 'Python pynput', success: false, error: e.message };
  }
}

/**
 * Test 5: Check for security keyboard characteristics
 */
async function analyzeSecurityKeyboard(page, field) {
  console.log('\n📋 Test 5: Analyzing Security Keyboard Characteristics');

  try {
    await field.focus();
    await page.waitForTimeout(500);

    const analysis = await page.evaluate(() => {
      const input = document.activeElement;

      return {
        tagName: input.tagName,
        type: input.type,
        readOnly: input.readOnly,
        disabled: input.disabled,
        autocomplete: input.autocomplete,
        classList: Array.from(input.classList),
        attributes: Array.from(input.attributes).map(attr => ({
          name: attr.name,
          value: attr.value
        })),
        hasKeydownListener: true, // Can't directly check
        parentClasses: input.parentElement ? Array.from(input.parentElement.classList) : [],

        // Check for security keyboard indicators
        hasSecurityKeyboard: !!(
          input.classList.contains('nppfs-input') ||
          input.classList.contains('security-input') ||
          input.getAttribute('data-security') ||
          document.querySelector('[class*="security"][class*="keyboard"]') ||
          document.querySelector('[class*="nppfs"]')
        )
      };
    });

    console.log('   Input Field Analysis:');
    console.log(`     Tag: ${analysis.tagName}, Type: ${analysis.type}`);
    console.log(`     Classes: ${analysis.classList.join(', ')}`);
    console.log(`     Security keyboard detected: ${analysis.hasSecurityKeyboard ? '✅ YES' : '❌ NO'}`);
    console.log(`     ReadOnly: ${analysis.readOnly}, Disabled: ${analysis.disabled}`);

    return analysis;
  } catch (e) {
    console.log(`   Error: ${e.message}`);
    return { error: e.message };
  }
}

/**
 * Main test runner
 */
async function runSecurityKeyboardTests() {
  console.log('═'.repeat(70));
  console.log('🔬 Security Keyboard Monitoring Level Test Suite');
  console.log('═'.repeat(70));
  console.log('\nTarget: Shinhan Card Password Field');
  console.log('Goal: Determine at what level the security keyboard monitors input\n');

  let browser, context, page;

  try {
    // Launch browser with same flags as actual automation
    console.log('🌐 Launching Chrome browser...');
    console.log('   Using production automation flags for accurate testing');

    browser = await chromium.launch({
      channel: 'chrome', // Use installed Chrome instead of Chromium
      headless: TEST_CONFIG.headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--allow-running-insecure-content',
        '--disable-features=PrivateNetworkAccessSendPreflights',
        '--disable-features=PrivateNetworkAccessRespectPreflightResults',
      ]
    });

    context = await browser.newContext({
      locale: 'ko-KR',
      viewport: { width: 1280, height: 1024 },
      permissions: ['clipboard-read', 'clipboard-write']
    });

    // Hide automation flags
    await context.addInitScript(() => {
      // Remove webdriver flag
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });

      // Override plugins and languages to look like a real browser
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      Object.defineProperty(navigator, 'languages', {
        get: () => ['ko-KR', 'ko', 'en-US', 'en'],
      });

      // Chrome specific properties
      window.chrome = {
        runtime: {},
      };

      // Permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });
    page = await context.newPage();

    // Verify automation hiding is working
    console.log('\n🔍 Verifying automation hiding...');
    const automationCheck = await page.evaluate(() => ({
      webdriver: navigator.webdriver,
      pluginsCount: navigator.plugins.length,
      languages: navigator.languages,
      hasChrome: !!window.chrome,
      userAgent: navigator.userAgent
    }));

    console.log(`   navigator.webdriver: ${automationCheck.webdriver} ${automationCheck.webdriver === false ? '✅' : '❌ DETECTED!'}`);
    console.log(`   navigator.plugins: ${automationCheck.pluginsCount} items ${automationCheck.pluginsCount > 0 ? '✅' : '❌'}`);
    console.log(`   navigator.languages: [${automationCheck.languages.join(', ')}] ✅`);
    console.log(`   window.chrome: ${automationCheck.hasChrome ? '✅ present' : '❌ missing'}`);
    console.log(`   User-Agent: ${automationCheck.userAgent.substring(0, 50)}...`);

    if (automationCheck.webdriver !== false) {
      console.log('\n⚠️  WARNING: Automation may be detected (webdriver flag is true)!');
    }
    console.log('');

    // Navigate to Shinhan Card
    console.log('🔗 Navigating to Shinhan Card...');
    await page.goto(TEST_CONFIG.url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Wait for password field
    console.log('🔍 Locating password field...');
    const passwordField = page.locator('input[type="password"]').first();
    await passwordField.waitFor({ state: 'visible', timeout: 10000 });

    console.log('✅ Password field found!\n');
    console.log('═'.repeat(70));
    console.log('Starting Tests...');
    console.log('═'.repeat(70));

    // Analyze security keyboard first
    const analysis = await analyzeSecurityKeyboard(page, passwordField);
    results.analysis = analysis;

    // Run all tests
    results.tests.push(await testPlaywrightKeyboard(page, passwordField));
    await page.waitForTimeout(1000);

    results.tests.push(await testDirectFill(page, passwordField));
    await page.waitForTimeout(1000);

    results.tests.push(await testDOMEvents(page, passwordField));
    await page.waitForTimeout(1000);

    results.tests.push(await testPynputOSLevel(page, passwordField));
    await page.waitForTimeout(1000);

    // Print summary
    console.log('\n' + '═'.repeat(70));
    console.log('📊 Test Results Summary');
    console.log('═'.repeat(70));

    results.tests.forEach((test, i) => {
      console.log(`\n${i + 1}. ${test.method}`);
      console.log(`   Level: ${test.level}`);
      console.log(`   Result: ${test.success ? '✅ ACCEPTED' : '❌ BLOCKED'}`);
      console.log(`   Detection Risk: ${test.detectionRisk || 'N/A'}`);
      if (test.valueLength !== undefined) {
        console.log(`   Characters Captured: ${test.valueLength}`);
      }
    });

    // Analysis
    console.log('\n' + '═'.repeat(70));
    console.log('🔍 Analysis & Recommendations');
    console.log('═'.repeat(70));

    const acceptedMethods = results.tests.filter(t => t.success);
    const blockedMethods = results.tests.filter(t => !t.success);

    console.log(`\n✅ Accepted Methods: ${acceptedMethods.length}/${results.tests.length}`);
    console.log(`❌ Blocked Methods: ${blockedMethods.length}/${results.tests.length}`);

    if (acceptedMethods.length === 0) {
      console.log('\n🔴 ALL METHODS BLOCKED');
      console.log('   The security keyboard blocks ALL automation attempts.');
      console.log('   Monitoring Level: VERY DEEP (possibly kernel driver)');
      console.log('\n   Recommendations:');
      console.log('   1. Check if OS-level input (pynput) had permission issues');
      console.log('   2. Try hardware USB HID emulator (USB Rubber Ducky)');
      console.log('   3. Reverse-engineer the security keyboard API');
      console.log('   4. Use official API if available');
    } else {
      console.log('\n🟢 SOME METHODS WORK!');
      console.log('\n   Working methods:');
      acceptedMethods.forEach(m => {
        console.log(`   ✅ ${m.method} (${m.level})`);
      });

      console.log('\n   Recommendation: Use the lowest-level working method');
    }

    console.log('\n' + '═'.repeat(70));
    console.log('⏸️  Browser will stay open for 30 seconds for manual inspection...');
    console.log('═'.repeat(70));

    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('\n❌ Test suite error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return results;
}

// Run tests
runSecurityKeyboardTests()
  .then(results => {
    console.log('\n✅ Test suite completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });
