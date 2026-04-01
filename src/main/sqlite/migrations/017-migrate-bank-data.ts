import Database from 'better-sqlite3';

/**
 * Migration 017: Migrate bank transaction data
 *
 * Copies bank transactions from the unified transactions table to the new
 * bank_transactions table. Identifies bank transactions by excluding records
 * where bank_id ends with '-card'.
 */
export function migrate017MigrateBankData(db: Database.Database): void {
  console.log('[Migration 017] Migrating bank transaction data...');

  // Check if source table exists
  const sourceTable = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'
  `).all();

  if (sourceTable.length === 0) {
    console.log('  ℹ️ Source transactions table does not exist - skipping migration');
    return;
  }

  // Check if destination table exists
  const destTable = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='bank_transactions'
  `).all();

  if (destTable.length === 0) {
    console.log('  ❌ Destination bank_transactions table does not exist - run migration 015 first');
    return;
  }

  // Check if already migrated
  const existingCount = db.prepare(`SELECT COUNT(*) as count FROM bank_transactions`).get() as { count: number };
  if (existingCount.count > 0) {
    console.log(`  ℹ️ bank_transactions already has ${existingCount.count} records - skipping migration`);
    return;
  }

  // Count bank transactions to migrate
  const sourceCount = db.prepare(`
    SELECT COUNT(*) as count
    FROM transactions
    WHERE bank_id NOT LIKE '%-card'
  `).get() as { count: number };

  console.log(`  📊 Found ${sourceCount.count} bank transactions to migrate`);

  if (sourceCount.count === 0) {
    console.log('  ℹ️ No bank transactions to migrate');
    return;
  }

  // Migrate bank transaction data
  console.log('  🔄 Copying bank transaction data...');

  const result = db.prepare(`
    INSERT INTO bank_transactions (
      id,
      account_id,
      bank_id,
      transaction_date,
      transaction_time,
      transaction_datetime,
      account_number,
      account_name,
      deposit,
      withdrawal,
      balance,
      branch,
      counterparty_account,
      counterparty_name,
      description,
      description2,
      memo,
      is_manual,
      category,
      created_at,
      updated_at
    )
    SELECT
      t.id,
      t.account_id,
      t.bank_id,
      t.date as transaction_date,
      t.time as transaction_time,
      COALESCE(t.transaction_datetime, t.date || ' ' || COALESCE(t.time, '00:00:00')) as transaction_datetime,
      a.account_number,
      a.account_name,
      t.deposit,
      t.withdrawal,
      t.balance,
      t.branch,
      NULL as counterparty_account,  -- Extract from metadata if needed in future
      t.counterparty as counterparty_name,
      t.description,
      NULL as description2,           -- Reserved for future use
      t.memo,
      0 as is_manual,                 -- All imported transactions are not manual
      t.category,
      t.created_at,
      datetime('now') as updated_at
    FROM transactions t
    LEFT JOIN accounts a ON a.id = t.account_id
    WHERE t.bank_id NOT LIKE '%-card'
  `).run();

  console.log(`  ✅ Migrated ${result.changes} bank transactions`);

  // Verify migration
  const migratedCount = db.prepare(`SELECT COUNT(*) as count FROM bank_transactions`).get() as { count: number };
  console.log(`  🔍 Verification: bank_transactions now has ${migratedCount.count} records`);

  if (migratedCount.count === sourceCount.count) {
    console.log('  ✅ Migration successful - counts match');
  } else {
    console.log(`  ⚠️ Count mismatch: expected ${sourceCount.count}, got ${migratedCount.count}`);
  }

  console.log('[Migration 017] Bank transaction data migration complete');
}
