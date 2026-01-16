// ============================================================================
// NH BUSINESS BANK - TEST SCRIPT
// ============================================================================
// Run: node src/main/financehub/banks/nh-business/test.js

const { createNHBusinessAutomator } = require('./index');

/**
 * Test the NH Business Bank automator
 */
async function testNHBusinessBank() {
  console.log('🚀 Starting NH Business Bank Automation Test...\n');

  // Create automator instance
  const automator = createNHBusinessAutomator({
    headless: false, // Keep browser visible
  });

  try {
    // Login with certificate password
    // NOTE: Replace 'your-cert-password' with actual certificate password
    const result = await automator.login({
      certificatePassword: 'your-cert-password',
    });

    console.log('\n📊 Automation Result:', result);

    if (result.success) {
      console.log('\n✅ SUCCESS: NH Business Bank automation completed!');
    } else {
      console.log('\n❌ FAILED:', result.error);
    }

    // Keep browser open for inspection
    console.log('\n🔍 Browser kept open for inspection. Press Ctrl+C to exit.');

    // Keep process alive
    await new Promise(() => {});

  } catch (error) {
    console.error('\n💥 Error:', error.message);
    console.error(error.stack);
  }
}

// Run the test
if (require.main === module) {
  testNHBusinessBank();
}

module.exports = { testNHBusinessBank };
