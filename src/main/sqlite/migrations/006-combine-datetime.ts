// ============================================
// Migration 006: Combine Date and Time into DateTime
// ============================================
// Combines separate date and time columns into a single transaction_datetime field
// Format: YYYY/MM/DD HH:MM:SS

import Database from 'better-sqlite3';

export function migrate006CombineDateTime(db: Database.Database): void {
  console.log('🕐 Migration 006: Combining date and time into transaction_datetime field...');

  // Check if column already exists
  const columns = db.prepare(`PRAGMA table_info(transactions)`).all() as any[];
  const hasColumn = columns.some((col: any) => col.name === 'transaction_datetime');

  if (!hasColumn) {
    // Column doesn't exist - add it and migrate data
    console.log('  Adding transaction_datetime column...');
    db.exec(`
      ALTER TABLE transactions ADD COLUMN transaction_datetime TEXT;
    `);

    // Populate transaction_datetime column from existing date and time fields
    console.log('  Migrating existing transaction data...');
    const updateStmt = db.prepare(`
      UPDATE transactions
      SET transaction_datetime = REPLACE(date, '-', '/') || ' ' || COALESCE(time, '00:00:00')
      WHERE transaction_datetime IS NULL
    `);
    const result = updateStmt.run();
    console.log(`  ✅ Updated ${result.changes} transactions with combined transaction_datetime`);
  } else {
    console.log('  ℹ️ transaction_datetime column already exists');
  }

  // CRITICAL FIX: Always ensure UNIQUE index exists (even if column already existed)
  // Check if dedup index exists
  const indexes = db.prepare(`PRAGMA index_list(transactions)`).all() as any[];
  const hasDedupIndex = indexes.some((idx: any) => idx.name === 'idx_transactions_dedup');

  console.log(`  🔍 Checking for dedup index: ${hasDedupIndex ? 'EXISTS ✓' : 'MISSING ❌'}`);

  if (!hasDedupIndex) {
    console.log('  ⚠️ CRITICAL: Dedup index missing - creating it now to prevent duplicates...');

    // Drop old unique index that uses old column names
    console.log('  Dropping old deduplication index...');
    db.exec(`DROP INDEX IF EXISTS idx_transactions_dedup`);

    // CRITICAL: Remove existing duplicates BEFORE creating UNIQUE index
    console.log('  🧹 Cleaning up existing duplicate transactions...');
    const deleteDuplicates = db.prepare(`
      DELETE FROM transactions
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM transactions
        GROUP BY account_id, transaction_datetime, withdrawal, deposit, balance
      )
    `);
    const deleteResult = deleteDuplicates.run();
    console.log(`  🗑️ Removed ${deleteResult.changes} duplicate transaction(s)`);

    // Create new unique index using transaction_datetime
    console.log('  Creating new deduplication index with transaction_datetime...');
    try {
      db.exec(`
        CREATE UNIQUE INDEX idx_transactions_dedup
          ON transactions(account_id, transaction_datetime, withdrawal, deposit, balance)
      `);
      console.log('  ✅ UNIQUE dedup index created successfully');

      // Verify it was created
      const verifyIndexes = db.prepare(`PRAGMA index_list(transactions)`).all() as any[];
      const verified = verifyIndexes.some((idx: any) => idx.name === 'idx_transactions_dedup');
      console.log(`  🔍 Verification: idx_transactions_dedup ${verified ? 'EXISTS ✓' : 'FAILED TO CREATE ❌'}`);

      if (verified) {
        const indexInfo = db.prepare(`PRAGMA index_info(idx_transactions_dedup)`).all();
        console.log('  📋 Dedup index columns:', indexInfo.map((i: any) => i.name).join(', '));
      }
    } catch (createError: any) {
      console.error('  ❌ FAILED to create UNIQUE dedup index:', createError.message);
      console.error('  ℹ️ This likely means there are still duplicates in the database');
      throw createError;
    }
  } else {
    console.log('  ✓ Dedup index already exists - skipping creation');

    // Still verify the index structure
    const indexInfo = db.prepare(`PRAGMA index_info(idx_transactions_dedup)`).all();
    console.log('  📋 Existing dedup index columns:', indexInfo.map((i: any) => i.name).join(', '));
  }

  // Additional indexes for performance
  console.log('  Creating transaction_datetime performance indexes...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_transactions_transaction_datetime ON transactions(transaction_datetime);
    CREATE INDEX IF NOT EXISTS idx_transactions_account_transaction_datetime ON transactions(account_id, transaction_datetime);
    CREATE INDEX IF NOT EXISTS idx_transactions_bank_transaction_datetime ON transactions(bank_id, transaction_datetime);
  `);

  // Note: We're keeping the old date and time columns for now for backward compatibility
  // They can be removed in a future migration once all code is updated

  console.log('✅ Migration 006 complete: transaction_datetime field and UNIQUE dedup index ready');
}
