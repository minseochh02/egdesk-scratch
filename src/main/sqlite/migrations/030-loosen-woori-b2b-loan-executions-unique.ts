import Database from 'better-sqlite3';

/**
 * Migration 030: Rebuild `woori_b2b_loan_executions` without the UNIQUE constraint
 * on `transaction_number`.
 *
 * Why: 거래번호 in the Woori 실행내역 export is not unique per row (24 rows in an
 * export collapsed to 1 DB row via the ON CONFLICT path). The new convention is
 * to use a content-hash `id` as the upsert key (set by the importer), and treat
 * `transaction_number` as a non-unique indexed field.
 *
 * SQLite cannot DROP a UNIQUE constraint via ALTER TABLE — we have to recreate.
 */
export function migrate030LoosenWooriB2bLoanExecutionsUnique(db: Database.Database): void {
  console.log('[Migration 030] Loosening UNIQUE on woori_b2b_loan_executions.transaction_number...');

  const exists = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='woori_b2b_loan_executions'`,
    )
    .get() as { name: string } | undefined;
  if (!exists) {
    console.log('  ℹ️ woori_b2b_loan_executions does not exist — skipping');
    return;
  }

  // Detect whether the UNIQUE is still present. If not, this migration has
  // already taken effect (or the original schema was different) — skip.
  const tableSql = (db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='woori_b2b_loan_executions'`)
    .get() as { sql: string } | undefined)?.sql || '';
  if (!/transaction_number\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i.test(tableSql)) {
    console.log('  ℹ️ UNIQUE on transaction_number not present — already loosened, skipping');
    return;
  }

  db.exec('BEGIN');
  try {
    db.exec(`
      CREATE TABLE woori_b2b_loan_executions_new (
        id TEXT PRIMARY KEY,

        transaction_number TEXT,
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

    db.exec(`
      INSERT INTO woori_b2b_loan_executions_new
      SELECT * FROM woori_b2b_loan_executions
    `);

    db.exec(`DROP TABLE woori_b2b_loan_executions`);
    db.exec(`ALTER TABLE woori_b2b_loan_executions_new RENAME TO woori_b2b_loan_executions`);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_woori_b2b_loan_executions_deposit
        ON woori_b2b_loan_executions(deposit_date);
      CREATE INDEX IF NOT EXISTS idx_woori_b2b_loan_executions_loan_maturity
        ON woori_b2b_loan_executions(loan_maturity_date);
      CREATE INDEX IF NOT EXISTS idx_woori_b2b_loan_executions_receivable
        ON woori_b2b_loan_executions(receivable_number);
      CREATE INDEX IF NOT EXISTS idx_woori_b2b_loan_executions_txn
        ON woori_b2b_loan_executions(transaction_number);
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS woori_b2b_loan_executions_updated_at
      AFTER UPDATE ON woori_b2b_loan_executions
      BEGIN
        UPDATE woori_b2b_loan_executions
        SET updated_at = datetime('now')
        WHERE id = NEW.id;
      END;
    `);

    db.exec('COMMIT');
    console.log('  ✅ Rebuilt woori_b2b_loan_executions without UNIQUE on transaction_number');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  console.log('[Migration 030] complete');
}
