import Database from 'better-sqlite3';

/**
 * Migration 023: Create promissory_notes table (어음)
 *
 * Schema aligned with promissory-notes-feature-design.md — supports issued/received
 * notes, lifecycle status, endorsement/discount JSON blobs, and upsert on
 * (note_number, bank_id).
 */
export function migrate023CreatePromissoryNotes(db: Database.Database): void {
  console.log('[Migration 023] Creating promissory_notes table...');

  const tables = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='promissory_notes'`)
    .all();

  if (tables.length > 0) {
    console.log('  ℹ️ promissory_notes table already exists — skipping creation');
    return;
  }

  db.exec(`
    CREATE TABLE promissory_notes (
      id TEXT PRIMARY KEY,

      account_id TEXT NOT NULL,
      bank_id TEXT NOT NULL,

      note_number TEXT NOT NULL,
      note_type TEXT NOT NULL
        CHECK (note_type IN ('issued', 'received')),

      issuer_name TEXT NOT NULL,
      issuer_registration_number TEXT,
      payee_name TEXT NOT NULL,
      payee_registration_number TEXT,

      amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'KRW',

      issue_date TEXT NOT NULL,
      maturity_date TEXT NOT NULL,
      collection_date TEXT,

      status TEXT NOT NULL
        CHECK (status IN (
          'active', 'collected', 'dishonored',
          'cancelled', 'endorsed', 'discounted'
        )),

      endorsement_info TEXT,
      discount_info TEXT,

      processing_bank TEXT,
      bank_branch TEXT,

      category TEXT,
      memo TEXT,
      is_manual INTEGER NOT NULL DEFAULT 0 CHECK (is_manual IN (0, 1)),

      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      metadata TEXT,

      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (bank_id) REFERENCES banks(id),
      UNIQUE (note_number, bank_id)
    );
  `);

  console.log('  ✅ promissory_notes table created');

  db.exec(`
    CREATE INDEX idx_promissory_notes_account
      ON promissory_notes(account_id);

    CREATE INDEX idx_promissory_notes_bank
      ON promissory_notes(bank_id);

    CREATE INDEX idx_promissory_notes_maturity
      ON promissory_notes(maturity_date);

    CREATE INDEX idx_promissory_notes_status
      ON promissory_notes(status);

    CREATE INDEX idx_promissory_notes_type
      ON promissory_notes(note_type);

    CREATE INDEX idx_promissory_notes_dates
      ON promissory_notes(issue_date, maturity_date);
  `);

  console.log('  ✅ Indexes created');

  db.exec(`
    CREATE TRIGGER update_promissory_notes_timestamp
    AFTER UPDATE ON promissory_notes
    BEGIN
      UPDATE promissory_notes
      SET updated_at = datetime('now')
      WHERE id = NEW.id;
    END;
  `);

  console.log('  ✅ updated_at trigger created');
  console.log('[Migration 023] promissory_notes setup complete');
}
