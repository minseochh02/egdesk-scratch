import Database from 'better-sqlite3';

/**
 * Migration 031: Create `ibk_loan_transactions` table for the IBK
 * 대출 → 대출조회 → 대출계좌조회 → (per-account) 거래내역조회 → 엑셀파일저장(출력용) export.
 *
 * Header row 3 in the Excel; rows 1–2 are title / account-info metadata that
 * the parser skips. 11 data columns + an `account_number` column we set from
 * the iteration loop (one DB table, account-discriminated rows).
 */
export function migrate031CreateIbkLoanTransactions(db: Database.Database): void {
  console.log('[Migration 031] Creating ibk_loan_transactions table...');

  const exists = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='ibk_loan_transactions'`,
    )
    .get() as { name: string } | undefined;

  if (exists) {
    console.log('  ℹ️ ibk_loan_transactions table already exists — skipping creation');
    return;
  }

  db.exec(`
    CREATE TABLE ibk_loan_transactions (
      id TEXT PRIMARY KEY,
      account_number TEXT NOT NULL,

      transaction_date TEXT,
      transaction_type TEXT,
      currency TEXT,

      transaction_amount INTEGER,
      principal_amount INTEGER,
      interest_amount INTEGER,
      loan_balance INTEGER,

      interest_rate REAL,

      start_date TEXT,
      end_date TEXT,
      status TEXT,

      synced_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  console.log('  ✅ ibk_loan_transactions table created');

  db.exec(`
    CREATE INDEX idx_ibk_loan_transactions_account ON ibk_loan_transactions(account_number);
    CREATE INDEX idx_ibk_loan_transactions_date ON ibk_loan_transactions(transaction_date);
    CREATE INDEX idx_ibk_loan_transactions_account_date
      ON ibk_loan_transactions(account_number, transaction_date);
  `);

  console.log('  ✅ Indexes created');

  db.exec(`
    CREATE TRIGGER ibk_loan_transactions_updated_at
    AFTER UPDATE ON ibk_loan_transactions
    BEGIN
      UPDATE ibk_loan_transactions
      SET updated_at = datetime('now')
      WHERE id = NEW.id;
    END;
  `);

  console.log('  ✅ updated_at trigger created');
  console.log('[Migration 031] ibk_loan_transactions setup complete');
}
