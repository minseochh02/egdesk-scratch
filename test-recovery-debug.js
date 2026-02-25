/**
 * Test Recovery System with Debug Flag
 *
 * Paste this into DevTools console to test recovery regardless of execution window
 */

(async () => {
  console.log('🐛 Testing Recovery System (DEBUG MODE)\n');

  // Step 1: Reset completed tasks to pending for testing
  console.log('🔄 Resetting completed tasks to pending...');
  const reset = await window.electron.schedulerRecovery.debugReset({
    schedulerType: 'financehub',
    lookbackDays: 7
  });
  console.log(`✅ Reset ${reset.data.resetCount} task(s) to pending\n`);

  // Step 2: Trigger recovery with debugForceRun flag
  console.log('🔄 Triggering recovery...');
  const result = await window.electron.schedulerRecovery.execute({
    schedulerType: 'financehub',
    lookbackDays: 7,
    autoExecute: true,
    maxCatchUpExecutions: 5,
    debugForceRun: true  // 🐛 This will run recovery on ALL pending/failed tasks
  });

  console.log('\n✅ Recovery Result:');
  console.log('  Missed:', result.data.missedCount);
  console.log('  Executed:', result.data.executedCount);
  console.log('  Failed:', result.data.failedCount);
  console.log('  Skipped:', result.data.skippedCount);

  if (result.data.executionResults.length > 0) {
    console.table(result.data.executionResults);
  }

  console.log('\n📝 Check recovery debug log for details');
})();
