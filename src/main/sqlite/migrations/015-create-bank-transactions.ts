import Database from 'better-sqlite3';

/**
 * Migration 015: Create bank_transactions table
 *
 * Creates a dedicated table for bank transactions with explicit columns
 * for all Korean financial reporting fields. Part of splitting the unified
 * transactions table into separate bank and card transaction tables.
 */
export function migrate015CreateBankTransactions(db: Database.Database): void {
  console.log('[Migration 015] Creating bank_transactions table...');

  // Check if table already exists
  const tables = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='bank_transactions'
  `).all();

  if (tables.length > 0) {
    console.log('  ℹ️ bank_transactions table already exists - skipping creation');
    return;
  }

  // Create bank_transactions table with all required columns
  db.exec(`
    CREATE TABLE bank_transactions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      bank_id TEXT NOT NULL,

      -- 거래일자, 거래시간
      transaction_date TEXT NOT NULL,           -- YYYY-MM-DD
      transaction_time TEXT,                    -- HH:MM:SS
      transaction_datetime TEXT NOT NULL,       -- Combined for sorting

      -- 은행, 계좌번호, 계좌별칭 (denormalized from accounts table)
      account_number TEXT,
      account_name TEXT,

      -- 입금, 출금, 잔액
      deposit INTEGER DEFAULT 0,
      withdrawal INTEGER DEFAULT 0,
      balance INTEGER DEFAULT 0,

      -- 취급지점, 상대계좌, 상대계좌예금주명
      branch TEXT,
      counterparty_account TEXT,
      counterparty_name TEXT,

      -- 적요1, 적요2 (optional - for leftover fields)
      description TEXT,
      description2 TEXT,

      -- 비고, 수기 (optional fields)
      memo TEXT,
      is_manual BOOLEAN DEFAULT 0,

      -- System fields
      category TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),

      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (bank_id) REFERENCES banks(id)
    );
  `);

  console.log('  ✅ bank_transactions table created');

  // Create indexes for performance
  console.log('  Creating indexes for bank_transactions...');
  db.exec(`
    -- Primary query indexes
    CREATE INDEX idx_bank_transactions_account_id
      ON bank_transactions(account_id);

    CREATE INDEX idx_bank_transactions_bank_id
      ON bank_transactions(bank_id);

    CREATE INDEX idx_bank_transactions_transaction_datetime
      ON bank_transactions(transaction_datetime);

    CREATE INDEX idx_bank_transactions_transaction_date
      ON bank_transactions(transaction_date);

    -- Category filter index
    CREATE INDEX idx_bank_transactions_category
      ON bank_transactions(category);

    -- Compound indexes for common queries
    CREATE INDEX idx_bank_transactions_account_date
      ON bank_transactions(account_id, transaction_date);

    CREATE INDEX idx_bank_transactions_account_datetime
      ON bank_transactions(account_id, transaction_datetime);

    -- Deduplication index (same as transactions table)
    CREATE UNIQUE INDEX idx_bank_transactions_dedup
      ON bank_transactions(account_id, transaction_datetime, withdrawal, deposit, balance);

    -- Search indexes
    CREATE INDEX idx_bank_transactions_description
      ON bank_transactions(description);

    CREATE INDEX idx_bank_transactions_counterparty
      ON bank_transactions(counterparty_name);
  `);

  console.log('  ✅ Indexes created');

  // Create trigger for updated_at timestamp
  console.log('  Creating updated_at trigger...');
  db.exec(`
    CREATE TRIGGER update_bank_transactions_timestamp
    AFTER UPDATE ON bank_transactions
    BEGIN
      UPDATE bank_transactions
      SET updated_at = datetime('now')
      WHERE id = NEW.id;
    END;
  `);

  console.log('  ✅ Trigger created');
  console.log('[Migration 015] Bank transactions table setup complete');
}
