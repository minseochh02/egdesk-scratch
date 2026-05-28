import Database from 'better-sqlite3';

/**
 * Migration 037: Create `ibk_foreign_currency_history` table.
 *
 * Stores per-row data from the IBK 외화거래내역조회 Excel export.
 * Excel columns: 거래일시, 통화, 입금, 출금, 거래후잔액, 적요, 수출계좌번호, 해외수입업자
 */
export function migrate037CreateIbkForeignCurrencyHistory(db: Database.Database): void {
  console.log('[Migration 037] Creating ibk_foreign_currency_history table...');

  const exists = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='ibk_foreign_currency_history'`,
    )
    .get() as { name: string } | undefined;

  if (exists) {
    console.log('  ℹ️ ibk_foreign_currency_history table already exists — skipping creation');
    return;
  }

  db.exec(`
    CREATE TABLE ibk_foreign_currency_history (
      id TEXT PRIMARY KEY,
      account_number TEXT NOT NULL,

      transaction_datetime TEXT NOT NULL,
      currency TEXT,

      credit REAL,
      debit REAL,
      balance REAL,

      memo TEXT,
      export_account_number TEXT,
      foreign_buyer TEXT,

      synced_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE INDEX idx_ibk_fxh_account ON ibk_foreign_currency_history(account_number);
    CREATE INDEX idx_ibk_fxh_datetime ON ibk_foreign_currency_history(transaction_datetime);
    CREATE INDEX idx_ibk_fxh_account_datetime
      ON ibk_foreign_currency_history(account_number, transaction_datetime);
  `);

  db.exec(`
    CREATE TRIGGER ibk_foreign_currency_history_updated_at
    AFTER UPDATE ON ibk_foreign_currency_history
    BEGIN
      UPDATE ibk_foreign_currency_history
      SET updated_at = datetime('now')
      WHERE id = NEW.id;
    END;
  `);

  console.log('[Migration 037] ibk_foreign_currency_history setup complete');
}
