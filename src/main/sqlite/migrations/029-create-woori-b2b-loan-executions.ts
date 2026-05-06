import Database from 'better-sqlite3';

/**
 * Migration 029: Create `woori_b2b_loan_executions` table for the Woori
 * 전자결제 → B2B대출(협력) → 대출_신청 → 실행내역 export.
 *
 * Header row 2 in the Excel (`실행내역조회 YYYYMMDD.xlsx`). 14 columns
 * (excluding the "No." row-index column which we don't store).
 */
export function migrate029CreateWooriB2bLoanExecutions(db: Database.Database): void {
  console.log('[Migration 029] Creating woori_b2b_loan_executions table...');

  const exists = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='woori_b2b_loan_executions'`,
    )
    .get() as { name: string } | undefined;

  if (exists) {
    console.log('  ℹ️ woori_b2b_loan_executions table already exists — skipping creation');
    return;
  }

  db.exec(`
    CREATE TABLE woori_b2b_loan_executions (
      id TEXT PRIMARY KEY,

      transaction_number TEXT NOT NULL UNIQUE,
      receivable_number TEXT,

      vendor TEXT,

      received_date TEXT,
      deposit_date TEXT,
      receivable_maturity_date TEXT,
      loan_maturity_date TEXT,

      applied_amount INTEGER,
      interest_amount INTEGER,
      deposit_amount INTEGER,
      receivable_amount INTEGER,
      loan_balance INTEGER,

      loan_interest_rate REAL,

      synced_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  console.log('  ✅ woori_b2b_loan_executions table created');

  db.exec(`
    CREATE INDEX idx_woori_b2b_loan_executions_deposit ON woori_b2b_loan_executions(deposit_date);
    CREATE INDEX idx_woori_b2b_loan_executions_loan_maturity ON woori_b2b_loan_executions(loan_maturity_date);
    CREATE INDEX idx_woori_b2b_loan_executions_receivable ON woori_b2b_loan_executions(receivable_number);
  `);

  console.log('  ✅ Indexes created');

  db.exec(`
    CREATE TRIGGER woori_b2b_loan_executions_updated_at
    AFTER UPDATE ON woori_b2b_loan_executions
    BEGIN
      UPDATE woori_b2b_loan_executions
      SET updated_at = datetime('now')
      WHERE id = NEW.id;
    END;
  `);

  console.log('  ✅ updated_at trigger created');
  console.log('[Migration 029] woori_b2b_loan_executions setup complete');
}
