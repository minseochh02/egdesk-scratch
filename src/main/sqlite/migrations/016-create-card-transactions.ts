import Database from 'better-sqlite3';

/**
 * Migration 016: Create card_transactions table
 *
 * Creates a dedicated table for card transactions with explicit columns
 * for all Korean financial reporting fields. Part of splitting the unified
 * transactions table into separate bank and card transaction tables.
 */
export function migrate016CreateCardTransactions(db: Database.Database): void {
  console.log('[Migration 016] Creating card_transactions table...');

  // Check if table already exists
  const tables = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='card_transactions'
  `).all();

  if (tables.length > 0) {
    console.log('  ℹ️ card_transactions table already exists - skipping creation');
    return;
  }

  // Create card_transactions table with all required columns
  db.exec(`
    CREATE TABLE card_transactions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,

      -- 카드사
      card_company_id TEXT NOT NULL,

      -- 본부명, 부서명 (BC Card specific)
      headquarters_name TEXT,
      department_name TEXT,

      -- 카드번호, 카드구분, 카드소지자
      card_number TEXT NOT NULL,
      card_type TEXT,                           -- 개인/법인
      cardholder_name TEXT,

      -- 거래은행, 사용구분, 매출종류
      transaction_bank TEXT,
      usage_type TEXT,                          -- 일시불/할부
      sales_type TEXT,                          -- 일반매출/취소

      -- 접수일자/(승인일자), 청구일자
      approval_datetime TEXT NOT NULL,          -- YYYY/MM/DD HH:MM:SS
      approval_date TEXT NOT NULL,              -- YYYY-MM-DD (for indexing)
      billing_date TEXT,

      -- 승인번호, 가맹점명/국가명(도시명), 이용금액
      approval_number TEXT,
      merchant_name TEXT NOT NULL,
      amount INTEGER NOT NULL,

      -- (US $) - only if provided in source data
      foreign_amount_usd REAL,

      -- 비고
      memo TEXT,

      -- System fields
      category TEXT,
      is_cancelled BOOLEAN DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),

      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (card_company_id) REFERENCES banks(id)
    );
  `);

  console.log('  ✅ card_transactions table created');

  // Create indexes for performance
  console.log('  Creating indexes for card_transactions...');
  db.exec(`
    -- Primary query indexes
    CREATE INDEX idx_card_transactions_account_id
      ON card_transactions(account_id);

    CREATE INDEX idx_card_transactions_card_company_id
      ON card_transactions(card_company_id);

    CREATE INDEX idx_card_transactions_approval_datetime
      ON card_transactions(approval_datetime);

    CREATE INDEX idx_card_transactions_approval_date
      ON card_transactions(approval_date);

    -- Category filter index
    CREATE INDEX idx_card_transactions_category
      ON card_transactions(category);

    -- Compound indexes for common queries
    CREATE INDEX idx_card_transactions_account_date
      ON card_transactions(account_id, approval_date);

    CREATE INDEX idx_card_transactions_account_datetime
      ON card_transactions(account_id, approval_datetime);

    -- Deduplication index (no account_id or card_number since BC Card masks cards)
    CREATE UNIQUE INDEX idx_card_transactions_dedup
      ON card_transactions(approval_datetime, merchant_name, amount);

    -- Search indexes
    CREATE INDEX idx_card_transactions_merchant_name
      ON card_transactions(merchant_name);

    CREATE INDEX idx_card_transactions_card_number
      ON card_transactions(card_number);

    CREATE INDEX idx_card_transactions_approval_number
      ON card_transactions(approval_number);

    CREATE INDEX idx_card_transactions_cardholder_name
      ON card_transactions(cardholder_name);

    -- Status filter index
    CREATE INDEX idx_card_transactions_is_cancelled
      ON card_transactions(is_cancelled);

    -- Billing date index for monthly reports
    CREATE INDEX idx_card_transactions_billing_date
      ON card_transactions(billing_date);
  `);

  console.log('  ✅ Indexes created');

  // Create trigger for updated_at timestamp
  console.log('  Creating updated_at trigger...');
  db.exec(`
    CREATE TRIGGER update_card_transactions_timestamp
    AFTER UPDATE ON card_transactions
    BEGIN
      UPDATE card_transactions
      SET updated_at = datetime('now')
      WHERE id = NEW.id;
    END;
  `);

  console.log('  ✅ Trigger created');
  console.log('[Migration 016] Card transactions table setup complete');
}
