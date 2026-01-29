/**
 * Simplified Security Keyboard Test - pynput (OS-level) Only
 *
 * This test focuses ONLY on testing Python pynput (OS-level keyboard input).
 * Browser automation methods are likely blocked, so we skip those and test
 * what really matters: does OS-level input bypass the security keyboard?
 *
 * Run: node test-pynput-only.js
 */

const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const path = require('path');

const TEST_CONFIG = {
  url: 'https://www.shinhancard.com/cconts/html/main.html', // Exact login URL from production
  passwordFieldSelector: '[id="pwd"]', // Exact password field from production
  testPassword: 'Test1234!',
  headless: false,
  timeout: 60000,
  skipDependencyCheck: false // Set to true to skip pynput check if you know it's installed
};

/**
 * Test Python pynput (OS-level keyboard events)
 */
async function testPynputOSLevel(page, field) {
  console.log('\n📋 Testing: Python pynput (OS-level keyboard events)');
  console.log('═'.repeat(70));
  console.log('   Level: Operating System kernel input stack');
  console.log('   Detection Risk: Low (appears as real keyboard)');
  console.log('');

  try {
    // Focus and clear the field
    console.log('   Step 1: Focusing password field...');
    await field.focus();
    await page.waitForTimeout(500);

    console.log('   Step 2: Clearing any existing content...');
    await field.fill('');
    await page.waitForTimeout(500);

    console.log('   Step 3: Preparing for OS-level input...');
    console.log('   ⚠️  CRITICAL: Do NOT touch keyboard or mouse for 5 seconds!');
    console.log('');
    await page.waitForTimeout(1000);

    // Use Python pynput
    const pythonScript = path.join(__dirname, 'src/main/financehub/utils/virtual-hid-keyboard.py');
    const testText = TEST_CONFIG.testPassword;

    // Use 'python' on Windows, 'python3' on Unix
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

    console.log('   Step 4: Spawning Python pynput...');
    console.log(`   Command: ${pythonCmd} virtual-hid-keyboard.py`);
    console.log(`   Text to type: "${testText}" (${testText.length} characters)`);
    console.log('');

    const pynputSuccess = await new Promise((resolve) => {
      const python = spawn(pythonCmd, [
        pythonScript,
        testText,
        '--delay', '120',
        '--pre-delay', '800'
      ]);

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log(`   [pynput] ${output.trim()}`);
      });

      python.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.log(`   [pynput] ${output.trim()}`);
      });

      python.on('close', (code) => {
        console.log(`   [pynput] Process exited with code: ${code}`);
        resolve(code === 0 && stdout.includes('SUCCESS'));
      });

      python.on('error', (err) => {
        console.error(`   [pynput] Error spawning Python: ${err.message}`);
        resolve(false);
      });

      // Timeout after 15 seconds
      setTimeout(() => {
        console.error('   [pynput] Timeout after 15 seconds');
        python.kill();
        resolve(false);
      }, 15000);
    });

    // Wait a bit for browser to update
    await page.waitForTimeout(1000);

    // Check if characters were captured
    console.log('');
    console.log('   Step 5: Verifying result...');
    const value = await field.inputValue();
    const success = value.length > 0;

    console.log('');
    console.log('═'.repeat(70));
    console.log('📊 RESULT:');
    console.log('═'.repeat(70));
    console.log(`   Python execution: ${pynputSuccess ? '✅ Success' : '❌ Failed'}`);
    console.log(`   Characters captured: ${value.length} / ${testText.length}`);
    console.log(`   Field value: "${value.length > 0 ? '*'.repeat(value.length) : '(empty)'}" `);
    console.log(`   Security keyboard bypassed: ${success ? '✅ YES!' : '❌ NO'}`);
    console.log('');

    return {
      method: 'Python pynput (OS-level)',
      level: 'OS Kernel Input Stack',
      success,
      valueLength: value.length,
      expectedLength: testText.length,
      pynputExecuted: pynputSuccess,
      detectionRisk: 'Low'
    };
  } catch (e) {
    console.log('');
    console.log('═'.repeat(70));
    console.log('❌ ERROR:');
    console.log('═'.repeat(70));
    console.log(`   ${e.message}`);
    console.log('');
    return { method: 'Python pynput', success: false, error: e.message };
  }
}

/**
 * Check dependencies
 */
async function checkDependencies() {
  console.log('🔍 Checking dependencies...');
  console.log('');

  // Check Python
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  console.log(`   Testing command: ${pythonCmd}`);

  const pythonCheck = await new Promise((resolve) => {
    const proc = spawn(pythonCmd, ['--version']);
    let version = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { version += data.toString(); });
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      version += data.toString(); // Python sometimes outputs version to stderr
    });
    proc.on('close', (code) => {
      resolve({ success: code === 0, version: version.trim(), stderr: stderr.trim() });
    });
    proc.on('error', (err) => {
      resolve({ success: false, version: 'Not found', error: err.message });
    });
  });

  console.log(`   Python: ${pythonCheck.success ? '✅' : '❌'} ${pythonCheck.version}`);
  if (!pythonCheck.success && pythonCheck.error) {
    console.log(`   Error: ${pythonCheck.error}`);
  }

  // Check pynput with better error handling
  const pynputCheck = await new Promise((resolve) => {
    const proc = spawn(pythonCmd, ['-c', 'import pynput; print("OK")']);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });
    proc.on('close', (code) => {
      resolve({
        success: code === 0 && stdout.includes('OK'),
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
    proc.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      proc.kill();
      resolve({ success: false, error: 'Timeout' });
    }, 5000);
  });

  console.log(`   pynput: ${pynputCheck.success ? '✅ Installed' : '❌ Not detected'}`);
  if (!pynputCheck.success) {
    if (pynputCheck.stderr) {
      console.log(`   Error output: ${pynputCheck.stderr}`);
    }
    if (pynputCheck.error) {
      console.log(`   Error: ${pynputCheck.error}`);
    }
  }
  console.log('');

  if (!pythonCheck.success) {
    console.log('❌ Python is not installed or not in PATH!');
    console.log('   Please install Python 3 from: https://www.python.org/downloads/');
    console.log('');
    return false;
  }

  if (!pynputCheck.success) {
    console.log('⚠️  pynput check failed!');
    console.log('');
    console.log('   If you KNOW pynput is installed, you can:');
    console.log('   1. Set TEST_CONFIG.skipDependencyCheck = true in the script');
    console.log('   2. Or manually verify: ' + pythonCmd + ' -c "import pynput; print(\'OK\')"');
    console.log('');
    console.log(`   If pynput is NOT installed: ${pythonCmd === 'python' ? 'pip' : 'pip3'} install pynput`);
    console.log('');

    // Ask if they want to continue anyway
    console.log('   The test will try to run anyway...');
    console.log('');
    return true; // Changed to return true to allow continuing
  }

  console.log('✅ All dependencies are installed!');
  console.log('');
  return true;
}

/**
 * Main test runner
 */
async function runPynputTest() {
  console.log('═'.repeat(70));
  console.log('🔬 Security Keyboard Test - OS-Level Input Only');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Target: Shinhan Card Login Page');
  console.log(`URL: ${TEST_CONFIG.url}`);
  console.log(`Password Field: ${TEST_CONFIG.passwordFieldSelector}`);
  console.log('');
  console.log('Testing: Python pynput (OS kernel input stack)');
  console.log('Goal: Can OS-level keyboard input bypass security keyboard?');
  console.log('');
  console.log('═'.repeat(70));
  console.log('');

  // Check dependencies first (unless skipped)
  if (!TEST_CONFIG.skipDependencyCheck) {
    const depsOk = await checkDependencies();
    if (!depsOk) {
      console.log('⚠️  Dependency check failed, but continuing anyway...');
      console.log('   Set TEST_CONFIG.skipDependencyCheck = true to skip this check');
      console.log('');
    }
  } else {
    console.log('⏭️  Skipping dependency check (TEST_CONFIG.skipDependencyCheck = true)');
    console.log('');
  }

  let browser, context, page;

  try {
    // Launch browser with production flags
    console.log('🌐 Launching Chrome with production automation flags...');
    browser = await chromium.launch({
      channel: 'chrome',
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
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en-US', 'en'] });
      window.chrome = { runtime: {} };
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });

    page = await context.newPage();

    // Verify automation hiding
    console.log('🔍 Verifying automation hiding...');
    const check = await page.evaluate(() => ({
      webdriver: navigator.webdriver,
      plugins: navigator.plugins.length,
      hasChrome: !!window.chrome
    }));
    console.log(`   navigator.webdriver: ${check.webdriver} ${check.webdriver === false ? '✅' : '❌'}`);
    console.log(`   navigator.plugins: ${check.plugins} items ✅`);
    console.log(`   window.chrome: ${check.hasChrome ? '✅' : '❌'}`);
    console.log('');

    // Navigate
    console.log('🔗 Navigating to Shinhan Card...');
    await page.goto(TEST_CONFIG.url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    console.log('   ✅ Page loaded');
    console.log('');

    // Find password field
    console.log('🔍 Locating password field...');
    console.log(`   Selector: ${TEST_CONFIG.passwordFieldSelector}`);
    const passwordField = page.locator(TEST_CONFIG.passwordFieldSelector);
    await passwordField.waitFor({ state: 'visible', timeout: 10000 });
    console.log('   ✅ Password field found!');
    console.log('');

    console.log('═'.repeat(70));

    // Run the test
    const result = await testPynputOSLevel(page, passwordField);

    // Final verdict
    console.log('═'.repeat(70));
    console.log('🎯 FINAL VERDICT:');
    console.log('═'.repeat(70));
    console.log('');

    if (result.success) {
      console.log('✅ SUCCESS! OS-level input (pynput) BYPASSES the security keyboard!');
      console.log('');
      console.log('What this means:');
      console.log('  ✅ Your current implementation will work');
      console.log('  ✅ Python pynput goes through OS kernel input stack');
      console.log('  ✅ Security keyboard accepts it as legitimate input');
      console.log('  ✅ No need for hardware USB emulator');
      console.log('');
      console.log('Next steps:');
      console.log('  1. Your Virtual HID implementation is already correct');
      console.log('  2. Make sure pynput is installed in production');
      console.log('  3. Run the actual automation with real credentials');
      console.log('');
    } else {
      console.log('❌ FAILED! OS-level input (pynput) is BLOCKED');
      console.log('');
      console.log('What this means:');
      console.log('  ❌ Security keyboard monitors at kernel level or deeper');
      console.log('  ❌ pynput input is being detected and blocked');
      console.log('  ❌ Current implementation will not work');
      console.log('');
      console.log('Next steps:');
      console.log('  1. Try hardware USB HID emulator (USB Rubber Ducky)');
      console.log('  2. Reverse-engineer the security keyboard API');
      console.log('  3. Check if there\'s an official API or alternative auth method');
      console.log('  4. Verify pynput has accessibility permissions');
      console.log('');

      if (!result.pynputExecuted) {
        console.log('⚠️  NOTE: Python pynput failed to execute');
        console.log('   This might be a setup issue, not security blocking');
        console.log('   Check:');
        console.log('   - Python and pynput are installed');
        console.log('   - Accessibility permissions (macOS)');
        console.log('   - Windows: Run as Administrator');
        console.log('');
      }
    }

    console.log('═'.repeat(70));
    console.log('⏸️  Browser will stay open for 30 seconds for manual inspection...');
    console.log('═'.repeat(70));
    console.log('');

    await page.waitForTimeout(30000);

    return result;

  } catch (error) {
    console.error('');
    console.error('═'.repeat(70));
    console.error('❌ Test error:');
    console.error('═'.repeat(70));
    console.error(error);
    console.error('');
    return { success: false, error: error.message };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run test
runPynputTest()
  .then(result => {
    console.log('✅ Test completed');
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
