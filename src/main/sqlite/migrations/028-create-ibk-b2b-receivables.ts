import Database from 'better-sqlite3';

/**
 * Migration 028: Create `ibk_b2b_receivables` table for IBK 외상매출채권 export.
 *
 * First table under the per-bank, per-product convention (see
 * `src/main/financehub/promissory-products.md`). Replaces the IBK-specific
 * usage of the generic `promissory_notes` table.
 *
 * Existing IBK rows in `promissory_notes` are copied over here. The old
 * `promissory_notes` table is intentionally NOT dropped in this migration —
 * the existing importer/IPC/UI still query it. A follow-up migration will
 * drop it once the code has been moved off the old table.
 */
export function migrate028CreateIbkB2bReceivables(db: Database.Database): void {
  console.log('[Migration 028] Creating ibk_b2b_receivables table...');

  const exists = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='ibk_b2b_receivables'`)
    .get() as { name: string } | undefined;

  if (exists) {
    console.log('  ℹ️ ibk_b2b_receivables table already exists — skipping creation');
    return;
  }

  db.exec(`
    CREATE TABLE ibk_b2b_receivables (
      id TEXT PRIMARY KEY,

      note_number TEXT NOT NULL UNIQUE,
      serial_number TEXT,

      buyer_name TEXT,
      buyer_biz_no TEXT,

      kind TEXT,
      status TEXT,
      cancellation_requested TEXT,
      cash_equivalent TEXT,

      receivable_amount INTEGER,
      original_note_amount INTEGER,

      registered_date TEXT,
      maturity_date TEXT,
      payment_date TEXT,
      tax_issued_date TEXT,

      loan_available_date TEXT,
      loan_executed TEXT,
      loan_amount INTEGER,

      deposit_account_number TEXT,
      payment_branch TEXT,

      seizure_amount INTEGER,
      seizure_claimant TEXT,

      synced_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  console.log('  ✅ ibk_b2b_receivables table created');

  db.exec(`
    CREATE INDEX idx_ibk_b2b_receivables_maturity ON ibk_b2b_receivables(maturity_date);
    CREATE INDEX idx_ibk_b2b_receivables_status ON ibk_b2b_receivables(status);
    CREATE INDEX idx_ibk_b2b_receivables_buyer ON ibk_b2b_receivables(buyer_name);
  `);

  console.log('  ✅ Indexes created');

  db.exec(`
    CREATE TRIGGER ibk_b2b_receivables_updated_at
    AFTER UPDATE ON ibk_b2b_receivables
    BEGIN
      UPDATE ibk_b2b_receivables
      SET updated_at = datetime('now')
      WHERE id = NEW.id;
    END;
  `);

  console.log('  ✅ updated_at trigger created');

  // Copy existing IBK rows from `promissory_notes`. Most fields map directly;
  // the rest live in the JSON `metadata` blob populated by
  // ibk-promissory-notes-excel.js. `status` prefers the original Korean text
  // from `metadata.rawStatus` over the mapped enum so we preserve the bank's
  // own lifecycle vocabulary.
  const promissoryExists = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='promissory_notes'`)
    .get() as { name: string } | undefined;

  if (promissoryExists) {
    const result = db
      .prepare(
        `
        INSERT INTO ibk_b2b_receivables (
          id, note_number, serial_number, buyer_name, buyer_biz_no,
          kind, status, cancellation_requested, cash_equivalent,
          receivable_amount, original_note_amount,
          registered_date, maturity_date, payment_date, tax_issued_date,
          loan_available_date, loan_executed, loan_amount,
          deposit_account_number, payment_branch,
          seizure_amount, seizure_claimant,
          synced_at, created_at, updated_at
        )
        SELECT
          id,
          note_number,
          json_extract(metadata, '$.serial'),
          issuer_name,
          issuer_registration_number,
          category,
          COALESCE(json_extract(metadata, '$.rawStatus'), status),
          json_extract(metadata, '$.cancellationRequested'),
          json_extract(metadata, '$.cashLike'),
          amount,
          CAST(json_extract(metadata, '$.originalNoteAmount') AS INTEGER),
          issue_date,
          maturity_date,
          collection_date,
          json_extract(metadata, '$.taxIssueDate'),
          json_extract(metadata, '$.loanAvailableDate'),
          json_extract(metadata, '$.loanExecuted'),
          CAST(json_extract(metadata, '$.loanAmount') AS INTEGER),
          json_extract(metadata, '$.depositAccountNumber'),
          bank_branch,
          CAST(json_extract(metadata, '$.seizureAmount') AS INTEGER),
          json_extract(metadata, '$.seizureClaimant'),
          COALESCE(updated_at, datetime('now')),
          COALESCE(created_at, datetime('now')),
          COALESCE(updated_at, datetime('now'))
        FROM promissory_notes
        WHERE bank_id = 'ibk'
          AND note_number IS NOT NULL
          AND TRIM(note_number) <> ''
        `,
      )
      .run();

    console.log(`  ✅ Copied ${result.changes} IBK rows from promissory_notes`);
  } else {
    console.log('  ℹ️ promissory_notes table not present — nothing to copy');
  }

  console.log('[Migration 028] ibk_b2b_receivables setup complete');
}
