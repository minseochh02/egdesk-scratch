import Database from 'better-sqlite3';

/**
 * Migration 036: Drop `ibk_loan_transactions` table.
 * This is a debug fix as the table is redundant with `ibk_loan_history`.
 */
export function migrate036DropIbkLoanTransactions(db: Database.Database): void {
  console.log('[Migration 036] Dropping ibk_loan_transactions table...');

  db.exec(`DROP TABLE IF EXISTS ibk_loan_transactions;`);
  
  // Also drop associated indexes and triggers (SQLite usually does this automatically with DROP TABLE, but being explicit is safer)
  db.exec(`DROP INDEX IF EXISTS idx_ibk_loan_transactions_account;`);
  db.exec(`DROP INDEX IF EXISTS idx_ibk_loan_transactions_date;`);
  db.exec(`DROP INDEX IF EXISTS idx_ibk_loan_transactions_account_date;`);
  db.exec(`DROP TRIGGER IF EXISTS ibk_loan_transactions_updated_at;`);

  console.log('  ✅ ibk_loan_transactions table and related objects dropped');
}
