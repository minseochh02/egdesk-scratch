import Database from 'better-sqlite3';

/**
 * Migration 019: Verify transaction table migration
 *
 * Performs integrity checks on the migrated data to ensure:
 * - All transactions were migrated
 * - No duplicate IDs exist
 * - Foreign keys are valid
 * - Required fields are not NULL
 */
export function migrate019VerifyMigration(db: Database.Database): void {
  console.log('[Migration 019] Verifying transaction table migration...');

  // Check if all tables exist
  const tables = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name IN ('transactions', 'bank_transactions', 'card_transactions')
  `).all() as { name: string }[];

  const hasTransactions = tables.some(t => t.name === 'transactions');
  const hasBankTransactions = tables.some(t => t.name === 'bank_transactions');
  const hasCardTransactions = tables.some(t => t.name === 'card_transactions');

  if (!hasTransactions) {
    console.log('  ℹ️ Source transactions table does not exist - skipping verification');
    return;
  }

  if (!hasBankTransactions || !hasCardTransactions) {
    console.log('  ⚠️ Destination tables do not exist - run migrations 015-016 first');
    return;
  }

  console.log('  ✅ All required tables exist');

  // 1. Verify row counts match
  console.log('\n  📊 Verifying row counts...');

  const originalCount = db.prepare(`SELECT COUNT(*) as count FROM transactions`).get() as { count: number };
  const bankCount = db.prepare(`SELECT COUNT(*) as count FROM bank_transactions`).get() as { count: number };
  const cardCount = db.prepare(`SELECT COUNT(*) as count FROM card_transactions`).get() as { count: number };
  const totalMigrated = bankCount.count + cardCount.count;

  console.log(`     Original transactions: ${originalCount.count}`);
  console.log(`     Bank transactions: ${bankCount.count}`);
  console.log(`     Card transactions: ${cardCount.count}`);
  console.log(`     Total migrated: ${totalMigrated}`);

  if (originalCount.count === totalMigrated) {
    console.log('     ✅ Counts match - all transactions migrated');
  } else {
    const diff = originalCount.count - totalMigrated;
    console.log(`     ⚠️ Count mismatch: ${Math.abs(diff)} transactions ${diff > 0 ? 'missing' : 'extra'}`);
  }

  // 2. Check for NULL values in required fields (bank_transactions)
  console.log('\n  🔍 Checking bank_transactions for NULL required fields...');

  const bankNulls = db.prepare(`
    SELECT COUNT(*) as count
    FROM bank_transactions
    WHERE transaction_date IS NULL
       OR transaction_datetime IS NULL
       OR account_id IS NULL
       OR bank_id IS NULL
  `).get() as { count: number };

  if (bankNulls.count === 0) {
    console.log('     ✅ No NULL values in required fields');
  } else {
    console.log(`     ⚠️ Found ${bankNulls.count} records with NULL required fields`);
  }

  // 3. Check for NULL values in required fields (card_transactions)
  console.log('\n  🔍 Checking card_transactions for NULL required fields...');

  const cardNulls = db.prepare(`
    SELECT COUNT(*) as count
    FROM card_transactions
    WHERE approval_date IS NULL
       OR approval_datetime IS NULL
       OR card_number IS NULL
       OR merchant_name IS NULL
       OR account_id IS NULL
       OR card_company_id IS NULL
  `).get() as { count: number };

  if (cardNulls.count === 0) {
    console.log('     ✅ No NULL values in required fields');
  } else {
    console.log(`     ⚠️ Found ${cardNulls.count} records with NULL required fields`);
  }

  // 4. Verify foreign key integrity (bank_transactions)
  console.log('\n  🔗 Checking bank_transactions foreign key integrity...');

  const bankInvalidAccounts = db.prepare(`
    SELECT COUNT(*) as count
    FROM bank_transactions bt
    WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id = bt.account_id)
  `).get() as { count: number };

  if (bankInvalidAccounts.count === 0) {
    console.log('     ✅ All account_id references are valid');
  } else {
    console.log(`     ⚠️ Found ${bankInvalidAccounts.count} records with invalid account_id`);
  }

  // 5. Verify foreign key integrity (card_transactions)
  console.log('\n  🔗 Checking card_transactions foreign key integrity...');

  const cardInvalidAccounts = db.prepare(`
    SELECT COUNT(*) as count
    FROM card_transactions ct
    WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id = ct.account_id)
  `).get() as { count: number };

  if (cardInvalidAccounts.count === 0) {
    console.log('     ✅ All account_id references are valid');
  } else {
    console.log(`     ⚠️ Found ${cardInvalidAccounts.count} records with invalid account_id`);
  }

  // 6. Check for duplicate IDs across both tables
  console.log('\n  🔍 Checking for duplicate IDs...');

  const duplicateIds = db.prepare(`
    SELECT id, COUNT(*) as count
    FROM (
      SELECT id FROM bank_transactions
      UNION ALL
      SELECT id FROM card_transactions
    )
    GROUP BY id
    HAVING COUNT(*) > 1
  `).all() as { id: string; count: number }[];

  if (duplicateIds.length === 0) {
    console.log('     ✅ No duplicate IDs found');
  } else {
    console.log(`     ⚠️ Found ${duplicateIds.length} duplicate IDs`);
    duplicateIds.slice(0, 5).forEach(d => {
      console.log(`        ID ${d.id} appears ${d.count} times`);
    });
  }

  // 7. Verify amount totals (sanity check)
  console.log('\n  💰 Verifying amount totals...');

  const originalBankTotal = db.prepare(`
    SELECT
      SUM(deposit) as total_deposits,
      SUM(withdrawal) as total_withdrawals
    FROM transactions
    WHERE bank_id NOT LIKE '%-card'
  `).get() as { total_deposits: number; total_withdrawals: number };

  const migratedBankTotal = db.prepare(`
    SELECT
      SUM(deposit) as total_deposits,
      SUM(withdrawal) as total_withdrawals
    FROM bank_transactions
  `).get() as { total_deposits: number; total_withdrawals: number };

  console.log(`     Original bank deposits: ${originalBankTotal.total_deposits || 0}`);
  console.log(`     Migrated bank deposits: ${migratedBankTotal.total_deposits || 0}`);
  console.log(`     Original bank withdrawals: ${originalBankTotal.total_withdrawals || 0}`);
  console.log(`     Migrated bank withdrawals: ${migratedBankTotal.total_withdrawals || 0}`);

  if (originalBankTotal.total_deposits === migratedBankTotal.total_deposits &&
      originalBankTotal.total_withdrawals === migratedBankTotal.total_withdrawals) {
    console.log('     ✅ Bank transaction amounts match');
  } else {
    console.log('     ⚠️ Bank transaction amounts do not match');
  }

  const originalCardTotal = db.prepare(`
    SELECT SUM(withdrawal + deposit) as total
    FROM transactions
    WHERE bank_id LIKE '%-card'
  `).get() as { total: number };

  const migratedCardTotalAll = db.prepare(`
    SELECT SUM(amount) as total
    FROM card_transactions
  `).get() as { total: number };

  const migratedCardTotalNonCancelled = db.prepare(`
    SELECT SUM(amount) as total
    FROM card_transactions
    WHERE is_cancelled = 0
  `).get() as { total: number };

  const cancelledTotal = db.prepare(`
    SELECT SUM(amount) as cancelled_total, COUNT(*) as cancelled_count
    FROM card_transactions
    WHERE is_cancelled = 1
  `).get() as { cancelled_total: number; cancelled_count: number };

  console.log(`     Original card total (all): ${originalCardTotal.total || 0}`);
  console.log(`     Migrated card total (all): ${migratedCardTotalAll.total || 0}`);
  console.log(`     Migrated card total (non-cancelled): ${migratedCardTotalNonCancelled.total || 0}`);
  console.log(`     Cancelled transactions: ${cancelledTotal.cancelled_count || 0} totaling ${cancelledTotal.cancelled_total || 0}`);

  if (originalCardTotal.total === migratedCardTotalAll.total) {
    console.log('     ✅ Card transaction amounts match (including cancelled)');
  } else {
    const diff = Math.abs((originalCardTotal.total || 0) - (migratedCardTotalAll.total || 0));
    console.log(`     ⚠️ Card transaction amounts differ by ${diff}`);
  }

  // 8. Summary
  console.log('\n  📋 Migration Verification Summary:');
  console.log(`     - Row count match: ${originalCount.count === totalMigrated ? '✅' : '⚠️'}`);
  console.log(`     - Bank required fields: ${bankNulls.count === 0 ? '✅' : '⚠️'}`);
  console.log(`     - Card required fields: ${cardNulls.count === 0 ? '✅' : '⚠️'}`);
  console.log(`     - Bank foreign keys: ${bankInvalidAccounts.count === 0 ? '✅' : '⚠️'}`);
  console.log(`     - Card foreign keys: ${cardInvalidAccounts.count === 0 ? '✅' : '⚠️'}`);
  console.log(`     - No duplicate IDs: ${duplicateIds.length === 0 ? '✅' : '⚠️'}`);

  console.log('\n[Migration 019] Verification complete');
}
