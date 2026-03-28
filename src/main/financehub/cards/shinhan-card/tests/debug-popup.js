// ============================================================================
// SHINHAN CARD POPUP DEBUG SCRIPT
// ============================================================================
// Use this to see EXACTLY when popups appear and what they look like

const { ShinhanCardAutomator } = require('../ShinhanCardAutomator');

async function debugPopups() {
  console.log('='.repeat(80));
  console.log('SHINHAN CARD POPUP DEBUG MODE');
  console.log('='.repeat(80));
  console.log('\nThis will show you:');
  console.log('  1. All visible buttons and links on each page');
  console.log('  2. When popup detection runs');
  console.log('  3. What popups are detected');
  console.log('  4. Screenshots at each step');
  console.log('='.repeat(80) + '\n');

  const automator = new ShinhanCardAutomator({
    headless: false,        // Keep browser visible
    manualPassword: true,   // Manual password entry
    debugPopups: true,      // Enable popup debugging
    outputDir: './debug-output'
  });

  try {
    const credentials = {
      userId: process.env.SHINHAN_CARD_USER_ID || 'YOUR_USER_ID',
      password: process.env.SHINHAN_CARD_PASSWORD || 'YOUR_PASSWORD',
    };

    console.log('\n🔍 STAGE 1: Initial Page Load');
    console.log('-'.repeat(80));
    console.log('Watch the console for:');
    console.log('  - "Waiting Xms for popups to appear..."');
    console.log('  - "Checking main page for popups..."');
    console.log('  - List of all visible buttons and links');
    console.log('');

    // Login will automatically debug and detect popups
    const loginResult = await automator.login(credentials);

    if (!loginResult.success) {
      console.error('\n❌ Login failed:', loginResult.error);
      console.log('\nCheck the debug screenshots in: ./debug-output/');
      return;
    }

    console.log('\n✅ Login successful!');
    console.log('\nCheck the console output above to see:');
    console.log('  - Which popups were detected (if any)');
    console.log('  - What buttons/links were visible');
    console.log('  - Screenshots saved in: ./debug-output/');

    // Wait a bit to observe
    console.log('\n⏸️  Pausing for 10 seconds to observe the page...');
    await automator.page.waitForTimeout(10000);

    console.log('\n🔍 STAGE 2: Manual Popup Detection');
    console.log('-'.repeat(80));
    console.log('Manually triggering popup detection right now...\n');

    const result = await automator.detectAndHandlePopups(automator.page, {
      waitBeforeCheck: 1000,
      retries: 1,
      logDetection: true
    });

    console.log('\n📊 Detection Results:');
    console.log(`  Detected: ${result.detected}`);
    console.log(`  Handled: ${result.handled}`);
    console.log(`  Popup count: ${result.popups.length}`);

    if (result.popups.length > 0) {
      console.log('\n  Popups found:');
      result.popups.forEach((popup, i) => {
        console.log(`    ${i + 1}. Type: ${popup.type}`);
        console.log(`       Selector: ${popup.selector}`);
      });
    }

    console.log('\n⏸️  Keeping browser open for 30 seconds...');
    console.log('  - Observe if any popups appear');
    console.log('  - Background monitoring is running every 3 seconds');
    await automator.page.waitForTimeout(30000);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    console.log('\n🧹 Cleaning up...');
    await automator.cleanup();
    console.log('✅ Done!\n');
  }
}

// Run the debug
if (require.main === module) {
  debugPopups()
    .then(() => {
      console.log('\n' + '='.repeat(80));
      console.log('DEBUG COMPLETE');
      console.log('='.repeat(80));
      console.log('\nWhat to do next:');
      console.log('  1. Review the console output above');
      console.log('  2. Check screenshots in ./debug-output/');
      console.log('  3. Look for patterns in button/link text');
      console.log('  4. If popup was missed, note WHEN it appeared');
      console.log('  5. Share the output to adjust timing/selectors');
      console.log('='.repeat(80) + '\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { debugPopups };
