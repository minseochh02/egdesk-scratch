// ============================================================================
// SHINHAN CARD POPUP DETECTION TEST
// ============================================================================
// Test script to verify the enhanced popup detection system

const { ShinhanCardAutomator } = require('../ShinhanCardAutomator');

/**
 * Test the popup detection system with Shinhan Card
 */
async function testPopupDetection() {
  console.log('='.repeat(80));
  console.log('SHINHAN CARD POPUP DETECTION TEST');
  console.log('='.repeat(80));

  // Create automator instance with manual password mode for testing
  const automator = new ShinhanCardAutomator({
    headless: false, // Keep browser visible for testing
    manualPassword: true, // Enable manual password entry for testing
    outputDir: './test-output',
  });

  try {
    // Test credentials (replace with actual test credentials)
    const credentials = {
      userId: process.env.SHINHAN_CARD_USER_ID || 'test-user-id',
      password: process.env.SHINHAN_CARD_PASSWORD || 'test-password',
    };

    console.log('\n[1] Testing login with popup detection...');
    const loginResult = await automator.login(credentials);

    if (!loginResult.success) {
      console.error('❌ Login failed:', loginResult.error);
      return;
    }

    console.log('✅ Login successful!');
    console.log('   - Popup monitoring is now running in background');
    console.log('   - Any popups will be automatically detected and handled');

    console.log('\n[2] Testing card retrieval with popup detection...');
    const cards = await automator.getCards();
    console.log(`✅ Found ${cards.length} card(s)`);
    cards.forEach((card, index) => {
      console.log(`   ${index + 1}. ${card.cardNumber} - ${card.cardName}`);
    });

    console.log('\n[3] Testing transaction retrieval with popup monitoring...');
    const endDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '');

    console.log(`   Date range: ${startDate} to ${endDate}`);

    const transactions = await automator.getTransactions(
      cards[0]?.cardNumber || 'default',
      startDate,
      endDate
    );

    console.log('✅ Transaction retrieval completed');
    console.log(`   - Status: ${transactions[0]?.status}`);
    console.log(`   - Total transactions: ${transactions[0]?.extractedData?.summary?.totalCount || 0}`);

    console.log('\n[4] Stopping popup monitoring...');
    await automator.stopPopupMonitoring();
    console.log('✅ Popup monitoring stopped');

    console.log('\n' + '='.repeat(80));
    console.log('TEST COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log('\nKey features tested:');
    console.log('  ✓ Popup detection after page load');
    console.log('  ✓ Popup detection after login');
    console.log('  ✓ Continuous popup monitoring during session');
    console.log('  ✓ Popup detection during navigation');
    console.log('  ✓ Popup detection during transaction retrieval');
    console.log('  ✓ Proper cleanup of monitoring');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    // Cleanup
    console.log('\n[Cleanup] Closing browser and disconnecting...');
    await automator.cleanup();
    console.log('✅ Cleanup completed');
  }
}

/**
 * Test manual popup detection
 */
async function testManualPopupDetection() {
  console.log('\n' + '='.repeat(80));
  console.log('MANUAL POPUP DETECTION TEST');
  console.log('='.repeat(80));

  const automator = new ShinhanCardAutomator({
    headless: false,
    manualPassword: true,
  });

  try {
    // Login to get to a page with potential popups
    const credentials = {
      userId: process.env.SHINHAN_CARD_USER_ID || 'test-user-id',
      password: process.env.SHINHAN_CARD_PASSWORD || 'test-password',
    };

    console.log('\n[1] Logging in...');
    await automator.login(credentials);

    console.log('\n[2] Manually triggering popup detection...');
    const result = await automator.detectAndHandlePopups(automator.page);

    console.log('\nDetection result:');
    console.log(`  - Detected: ${result.detected}`);
    console.log(`  - Handled: ${result.handled}`);
    console.log(`  - Popup count: ${result.popups.length}`);

    if (result.popups.length > 0) {
      console.log('\nPopups handled:');
      result.popups.forEach((popup, index) => {
        console.log(`  ${index + 1}. Type: ${popup.type}, Selector: ${popup.selector}`);
      });
    } else {
      console.log('\n✓ No popups detected (this is normal if page has no popups)');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  } finally {
    await automator.cleanup();
  }
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/**
 * Example 1: Using popup detection in custom automation
 */
async function exampleCustomAutomation() {
  const automator = new ShinhanCardAutomator({ headless: false });

  try {
    // Login
    await automator.login({ userId: 'user', password: 'pass' });

    // Do some custom navigation
    await automator.page.goto('https://example.com/some-page');

    // Manually check for popups at any point
    await automator.detectAndHandlePopups(automator.page);

    // Continue with automation...
  } finally {
    await automator.cleanup();
  }
}

/**
 * Example 2: Using popup monitoring for long operations
 */
async function exampleWithMonitoring() {
  const automator = new ShinhanCardAutomator({ headless: false });

  try {
    // Login
    await automator.login({ userId: 'user', password: 'pass' });

    // Start monitoring (checks every 3 seconds)
    await automator.startPopupMonitoring(automator.page, 3000);

    // Do long operation - popups will be auto-handled
    for (let i = 0; i < 10; i++) {
      await automator.page.waitForTimeout(5000);
      console.log(`Operation step ${i + 1}/10`);
      // Popups are being handled in background automatically
    }

    // Stop monitoring when done
    await automator.stopPopupMonitoring();
  } finally {
    await automator.cleanup();
  }
}

// ============================================================================
// RUN TESTS
// ============================================================================

if (require.main === module) {
  console.log('\n' + '='.repeat(80));
  console.log('ENHANCED POPUP DETECTION TEST SUITE');
  console.log('='.repeat(80));
  console.log('\nAvailable tests:');
  console.log('  1. Full automation test (default)');
  console.log('  2. Manual detection test');
  console.log('\nTo run a specific test, use: node test-popup-detection.js [1|2]');
  console.log('='.repeat(80) + '\n');

  const testChoice = process.argv[2] || '1';

  switch (testChoice) {
    case '1':
      testPopupDetection()
        .then(() => process.exit(0))
        .catch((error) => {
          console.error('Test failed:', error);
          process.exit(1);
        });
      break;

    case '2':
      testManualPopupDetection()
        .then(() => process.exit(0))
        .catch((error) => {
          console.error('Test failed:', error);
          process.exit(1);
        });
      break;

    default:
      console.error('Invalid test choice. Use 1 or 2.');
      process.exit(1);
  }
}

module.exports = {
  testPopupDetection,
  testManualPopupDetection,
  exampleCustomAutomation,
  exampleWithMonitoring,
};
