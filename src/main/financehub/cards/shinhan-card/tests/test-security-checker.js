// ============================================================================
// TEST KOREAN SECURITY APP CHECKER
// ============================================================================
// Test script to verify Korean security app detection

const {
  checkKoreanSecurityApps,
  checkSpecificSecurityApp,
  getSecurityStatusReport,
  SECURITY_APPS,
} = require('../../../utils/korean-security-checker');

async function testSecurityChecker() {
  console.log('='.repeat(60));
  console.log('Korean Security App Checker Test');
  console.log('='.repeat(60));
  console.log();

  try {
    // Test 1: Check all security apps
    console.log('Test 1: Checking all Korean security apps...');
    console.log('-'.repeat(60));
    const status = await checkKoreanSecurityApps();

    console.log('Success:', status.success);
    console.log('All Required Running:', status.allRequiredRunning);
    console.log('Timestamp:', status.timestamp);
    console.log();

    // Test 2: Get formatted report
    console.log('Test 2: Getting formatted status report...');
    console.log('-'.repeat(60));
    const report = await getSecurityStatusReport();
    console.log(report);

    // Test 3: Check specific app (TouchEn nxKey)
    console.log('Test 3: Checking specific app (TouchEn nxKey)...');
    console.log('-'.repeat(60));
    const touchEnStatus = await checkSpecificSecurityApp('touchEn');
    console.log('App:', touchEnStatus.name);
    console.log('Description:', touchEnStatus.description);
    console.log('Required:', touchEnStatus.required);
    console.log('Running:', touchEnStatus.isRunning);
    console.log('Processes:', touchEnStatus.processes);
    console.log();

    // Test 4: List all configured security apps
    console.log('Test 4: Listing all configured security apps...');
    console.log('-'.repeat(60));
    for (const [key, config] of Object.entries(SECURITY_APPS)) {
      console.log(`${key}:`);
      console.log(`  Name: ${config.name}`);
      console.log(`  Required: ${config.required}`);
      console.log(`  Process Names: ${config.processNames.join(', ')}`);
      console.log();
    }

    // Test 5: Integration test message
    console.log('Test 5: Integration with Shinhan Card Automator...');
    console.log('-'.repeat(60));
    console.log('The security checker is now integrated into ShinhanCardAutomator.');
    console.log('When you run the login() method, it will automatically:');
    console.log('  1. Check for required security apps');
    console.log('  2. Log a detailed status report');
    console.log('  3. Show warnings if required apps are missing');
    console.log('  4. Include security status in the login result');
    console.log();

    console.log('='.repeat(60));
    console.log('All tests completed successfully!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  testSecurityChecker().catch(console.error);
}

module.exports = { testSecurityChecker };
