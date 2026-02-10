// ============================================
// Migration 006: Combine Date and Time into DateTime
// ============================================
// Combines separate date and time columns into a single datetime field
// Format: YYYY/MM/DD HH:MM:SS

import Database from 'better-sqlite3';

export function migrate006CombineDateTime(db: Database.Database): void {
  console.log('🕐 Migration 006: Combining date and time into datetime field...');

  // Step 1: Add datetime column to transactions table
  console.log('  Adding datetime column...');
  db.exec(`
    ALTER TABLE transactions ADD COLUMN datetime TEXT;
  `);

  // Step 2: Populate datetime column from existing date and time fields
  // Format: Convert "2025-12-20" + "03:45:27" -> "2025/12/20 03:45:27"
  console.log('  Migrating existing transaction data...');
  const updateStmt = db.prepare(`
    UPDATE transactions
    SET datetime = REPLACE(date, '-', '/') || ' ' || COALESCE(time, '00:00:00')
    WHERE datetime IS NULL
  `);
  const result = updateStmt.run();
  console.log(`  ✅ Updated ${result.changes} transactions with combined datetime`);

  // Step 3: Drop old unique index that uses separate date and time
  console.log('  Dropping old deduplication index...');
  db.exec(`DROP INDEX IF EXISTS idx_transactions_dedup`);

  // Step 4: Create new unique index using datetime instead
  console.log('  Creating new deduplication index with datetime...');
  db.exec(`
    CREATE UNIQUE INDEX idx_transactions_dedup
      ON transactions(account_id, datetime, withdrawal, deposit, balance)
  `);

  // Step 5: Create index on datetime for faster date range queries
  console.log('  Creating datetime index...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_transactions_datetime ON transactions(datetime)
  `);

  // Step 6: Update composite indexes to use datetime
  console.log('  Updating composite indexes...');
  db.exec(`DROP INDEX IF EXISTS idx_transactions_account_date`);
  db.exec(`DROP INDEX IF EXISTS idx_transactions_bank_date`);
  db.exec(`DROP INDEX IF EXISTS idx_transactions_date`);

  db.exec(`
    CREATE INDEX idx_transactions_account_datetime ON transactions(account_id, datetime);
  `);

  db.exec(`
    CREATE INDEX idx_transactions_bank_datetime ON transactions(bank_id, datetime);
  `);

  // Note: We're keeping the old date and time columns for now for backward compatibility
  // They can be removed in a future migration once all code is updated

  console.log('✅ Migration 006 complete: datetime field created and populated');
}
