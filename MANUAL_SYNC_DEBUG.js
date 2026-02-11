// Manual Sync for Debugging
// This will trigger a fresh sync for ALL enabled entities so we can watch the logs

(async () => {
  console.log('═══════════════════════════════════');
  console.log('🔄 MANUAL SYNC (All Enabled Entities)');
  console.log('═══════════════════════════════════\n');

  try {
    console.log('📊 Checking current state...');
    
    // Check current transactions
    const beforeTx = await window.electron.financeHubDb.queryTransactions({
      bankId: 'bc-card',
      startDate: '20260201',
      endDate: '20260212'
    });
    
    console.log(`   Current BC Card transactions: ${beforeTx.success ? beforeTx.data.length : 'error'}`);
    
    console.log('\n🚀 Starting manual sync (all enabled entities)...');
    console.log('⚠️  WATCH THE TERMINAL LOGS FOR DEBUG OUTPUT');
    console.log('⚠️  Look for [FinanceHubDb] messages\n');
    
    // Trigger manual sync via scheduler (syncs all enabled entities)
    const result = await window.electron.financeHubScheduler.syncNow();
    
    console.log('\n✅ Sync completed!');
    console.log('Result:', result);
    
    // Check transactions after
    const afterTx = await window.electron.financeHubDb.queryTransactions({
      bankId: 'bc-card',
      startDate: '20260201',
      endDate: '20260212'
    });
    
    const before = beforeTx.success ? beforeTx.data.length : 0;
    const after = afterTx.success ? afterTx.data.length : 0;
    
    console.log(`\n📊 Results:`);
    console.log(`   Before: ${before} transactions`);
    console.log(`   After: ${after} transactions`);
    console.log(`   New: ${after - before} transactions`);
    
    if (after === before) {
      console.log('\n⚠️  NO NEW TRANSACTIONS ADDED!');
      console.log('   Check the terminal logs above for errors');
      console.log('   Look for [FinanceHubDb] messages');
    } else {
      console.log('\n🎉 SUCCESS! Transactions were saved to database');
    }
    
  } catch (error) {
    console.error('\n❌ Sync failed:', error);
  }
  
  console.log('\n');
})();
