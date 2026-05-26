import Database from 'better-sqlite3';

/**
 * Migration 035: Create `ibk_endorsements` and `hana_loan_history` tables.
 */
export function migrate035CreateBankingProductTables(db: Database.Database): void {
  console.log('[Migration 035] Creating banking product tables...');

  // 1. ibk_endorsements
  const existsEndorsements = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='ibk_endorsements'`)
    .get() as { name: string } | undefined;

  if (!existsEndorsements) {
    db.exec(`
      CREATE TABLE ibk_endorsements (
        id TEXT PRIMARY KEY,
        note_number TEXT NOT NULL,
        issuer_name TEXT,
        issuer_biz_no TEXT,
        issue_date TEXT,
        maturity_date TEXT,
        endorser_name TEXT,
        endorser_id_no TEXT,
        status TEXT,
        endorsement_date TEXT,
        unsecured_endorsement TEXT,
        endorsement_prohibited TEXT,
        guaranteed TEXT,
        default_date TEXT,
        final_payment_date TEXT,
        payment_bank_branch_code TEXT,
        payment_bank_branch_name TEXT,
        issuer_checking_account TEXT,
        endorser_deposit_account TEXT,
        split_number TEXT,
        endorsement_number TEXT,
        endorsement_amount INTEGER,
        endorsee_name TEXT,
        endorsee_id_no TEXT,
        endorsee_deposit_account TEXT,
        synced_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(note_number, split_number, endorsement_number)
      );
    `);
    db.exec(`
      CREATE INDEX idx_ibk_endorsements_note_number ON ibk_endorsements(note_number);
      CREATE INDEX idx_ibk_endorsements_endorsement_date ON ibk_endorsements(endorsement_date);
      CREATE INDEX idx_ibk_endorsements_maturity_date ON ibk_endorsements(maturity_date);
      CREATE INDEX idx_ibk_endorsements_status ON ibk_endorsements(status);
      CREATE TRIGGER ibk_endorsements_updated_at
      AFTER UPDATE ON ibk_endorsements
      BEGIN
        UPDATE ibk_endorsements SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
    `);
    console.log('  ✅ ibk_endorsements table created');
  }

  // 2. hana_loan_history
  const existsHanaLoan = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='hana_loan_history'`)
    .get() as { name: string } | undefined;

  if (!existsHanaLoan) {
    db.exec(`
      CREATE TABLE hana_loan_history (
        id TEXT PRIMARY KEY,
        account_number TEXT NOT NULL,
        transaction_date TEXT NOT NULL,
        description TEXT,
        currency TEXT,
        amount INTEGER,
        interest INTEGER,
        fee INTEGER,
        balance INTEGER,
        interest_start_date TEXT,
        interest_end_date TEXT,
        interest_rate REAL,
        branch TEXT,
        synced_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.exec(`
      CREATE INDEX idx_hana_loan_history_account ON hana_loan_history(account_number);
      CREATE INDEX idx_hana_loan_history_date ON hana_loan_history(transaction_date);
      CREATE TRIGGER hana_loan_history_updated_at
      AFTER UPDATE ON hana_loan_history
      BEGIN
        UPDATE hana_loan_history SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
    `);
    console.log('  ✅ hana_loan_history table created');
  }

  // 3. ibk_loan_history
  const existsIbkLoan = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='ibk_loan_history'`)
    .get() as { name: string } | undefined;

  if (!existsIbkLoan) {
    db.exec(`
      CREATE TABLE ibk_loan_history (
        id TEXT PRIMARY KEY,
        account_number TEXT,
        transaction_date TEXT NOT NULL,
        description TEXT,
        currency TEXT,
        amount INTEGER,
        interest INTEGER,
        fee INTEGER,
        balance INTEGER,
        interest_start_date TEXT,
        interest_end_date TEXT,
        interest_rate REAL,
        branch TEXT,
        synced_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.exec(`
      CREATE INDEX idx_ibk_loan_history_account ON ibk_loan_history(account_number);
      CREATE INDEX idx_ibk_loan_history_date ON ibk_loan_history(transaction_date);
      CREATE INDEX idx_ibk_loan_history_description ON ibk_loan_history(description);
      CREATE TRIGGER ibk_loan_history_updated_at
      AFTER UPDATE ON ibk_loan_history
      BEGIN
        UPDATE ibk_loan_history SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
    `);
    console.log('  ✅ ibk_loan_history table created');
  }

  console.log('[Migration 035] Banking product tables setup complete');
}
