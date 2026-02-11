// Check Database State
// Simple script to check current state using existing APIs

(async () => {
  console.log('═══════════════════════════════════');
  console.log('📊 DATABASE STATE CHECK');
  console.log('═══════════════════════════════════\n');

  try {
    // Check accounts
    const accountsResult = await window.electron.financeHubDb.getAllAccounts();
    if (accountsResult.success) {
      const bcAccounts = accountsResult.data.filter(a => a.bankId === 'bc-card');
      console.log(`📋 BC Card Accounts: ${bcAccounts.length}`);
      bcAccounts.forEach(acc => {
        console.log(`   - ${acc.accountNumber}: ${acc.accountName}`);
      });
    }
    
    // Check transactions using query
    const txResult = await window.electron.financeHubDb.queryTransactions({
      bankId: 'bc-card',
      startDate: '20260201',
      endDate: '20260212'
    });
    
    if (txResult.success) {
      console.log(`\n💰 BC Card Transactions: ${txResult.data.length}`);
      if (txResult.data.length > 0) {
        console.log(`   First transaction:`, txResult.data[0].description);
        console.log(`   Last transaction:`, txResult.data[txResult.data.length - 1].description);
      }
    }
    
    // Check sync operations
    const syncOps = await window.electron.financeHubDb.getRecentSyncOperations(10);
    if (syncOps.success) {
      const bcSyncs = syncOps.data.filter(s => s.bankId === 'bc-card');
      console.log(`\n🔄 Recent BC Card Syncs: ${bcSyncs.length}`);
      bcSyncs.forEach(sync => {
        console.log(`   - ${sync.startedAt}: ${sync.status} (${sync.newCount} new, ${sync.skippedCount} skipped)`);
      });
    }
    
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Failed:', error);
  }
})();
