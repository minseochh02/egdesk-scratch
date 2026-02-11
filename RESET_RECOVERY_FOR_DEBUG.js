// Reset Recovery System for Debugging
// Run this in DevTools Console to force recovery to run again

(async () => {
  console.log('═══════════════════════════════════');
  console.log('🔄 RESET RECOVERY FOR DEBUGGING');
  console.log('═══════════════════════════════════\n');

  try {
    const result = await window.electron.invoke('execute-js', `
      const { getSchedulerRecoveryService } = require('./scheduler/recovery-service');
      const { getSQLiteManager } = require('./sqlite/manager');
      
      const recoveryService = getSchedulerRecoveryService();
      const sqliteManager = getSQLiteManager();
      const db = sqliteManager.getFinanceHubManager().db;
      
      console.log('📊 Current state:');
      
      // 1. Count pending intents
      const pendingCount = db.prepare(\`
        SELECT COUNT(*) as count 
        FROM scheduler_execution_intents 
        WHERE status = 'pending'
      \`).get().count;
      console.log(\`   Pending intents: \${pendingCount}\`);
      
      // 2. Count completed intents
      const completedCount = db.prepare(\`
        SELECT COUNT(*) as count 
        FROM scheduler_execution_intents 
        WHERE status = 'completed'
      \`).get().count;
      console.log(\`   Completed intents: \${completedCount}\`);
      
      // 3. Show BC Card transactions
      const bcTransactions = db.prepare(\`
        SELECT COUNT(*) as count 
        FROM transactions 
        WHERE account_id IN (
          SELECT id FROM accounts WHERE bank_id = 'bc-card'
        )
      \`).get().count;
      console.log(\`   BC Card transactions in DB: \${bcTransactions}\`);
      
      console.log('\\n🔧 Resetting for debug...');
      
      // 4. Reset all 'completed' intents back to 'pending' for testing
      const resetCount = db.prepare(\`
        UPDATE scheduler_execution_intents 
        SET status = 'pending',
            actual_execution_id = NULL,
            actual_started_at = NULL,
            actual_completed_at = NULL,
            error_message = NULL
        WHERE status = 'completed'
          AND scheduler_type = 'financehub'
          AND task_id LIKE 'card:%'
          AND intended_date >= date('now', '-7 days')
      \`).run().changes;
      
      console.log(\`   ✅ Reset \${resetCount} completed intents to pending\`);
      
      // 5. Optional: Clear BC Card transactions for clean test
      // Uncomment if you want to start fresh
      // const deletedTx = db.prepare(\`
      //   DELETE FROM transactions 
      //   WHERE account_id IN (
      //     SELECT id FROM accounts WHERE bank_id = 'bc-card'
      //   )
      // \`).run().changes;
      // console.log(\`   🗑️  Deleted \${deletedTx} BC Card transactions\`);
      
      JSON.stringify({ 
        success: true, 
        pendingCount,
        completedCount,
        bcTransactions,
        resetCount 
      });
    `);

    const data = JSON.parse(result);
    
    console.log('\n═══════════════════════════════════');
    console.log('✅ RESET COMPLETE');
    console.log('═══════════════════════════════════');
    console.log(`\n📊 Summary:`);
    console.log(`   - Pending intents: ${data.pendingCount}`);
    console.log(`   - Completed intents: ${data.completedCount}`);
    console.log(`   - BC Card transactions: ${data.bcTransactions}`);
    console.log(`   - Reset to pending: ${data.resetCount}`);
    
    console.log('\n💡 Next steps:');
    console.log('   1. Restart scheduler:');
    console.log('      await window.electron.financeHubScheduler.stop()');
    console.log('      await window.electron.financeHubScheduler.start()');
    console.log('   2. Watch logs for recovery execution');
    console.log('   3. Check database after recovery completes\n');

  } catch (error) {
    console.error('❌ Failed:', error);
  }
})();
