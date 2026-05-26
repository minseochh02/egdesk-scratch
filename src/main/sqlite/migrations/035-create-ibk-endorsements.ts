import Database from 'better-sqlite3';

/**
 * Migration 035: Create `ibk_endorsements` table for IBK 배서내역 (Endorsement History) export.
 */
export function migrate035CreateIbkEndorsements(db: Database.Database): void {
  console.log('[Migration 035] Creating ibk_endorsements table...');

  const exists = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='ibk_endorsements'`)
    .get() as { name: string } | undefined;

  if (exists) {
    console.log('  ℹ️ ibk_endorsements table already exists — skipping creation');
    return;
  }

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

  console.log('  ✅ ibk_endorsements table created');

  db.exec(`
    CREATE INDEX idx_ibk_endorsements_note_number ON ibk_endorsements(note_number);
    CREATE INDEX idx_ibk_endorsements_endorsement_date ON ibk_endorsements(endorsement_date);
    CREATE INDEX idx_ibk_endorsements_maturity_date ON ibk_endorsements(maturity_date);
    CREATE INDEX idx_ibk_endorsements_status ON ibk_endorsements(status);
  `);

  console.log('  ✅ Indexes created');

  db.exec(`
    CREATE TRIGGER ibk_endorsements_updated_at
    AFTER UPDATE ON ibk_endorsements
    BEGIN
      UPDATE ibk_endorsements
      SET updated_at = datetime('now')
      WHERE id = NEW.id;
    END;
  `);

  console.log('  ✅ updated_at trigger created');
  console.log('[Migration 035] ibk_endorsements setup complete');
}
