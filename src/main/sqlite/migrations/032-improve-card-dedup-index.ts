import Database from 'better-sqlite3';

/**
 * Migration 032: Improve card_transactions deduplication index
 * 
 * Adds a global unique index on (card_company_id, approval_number) 
 * to prevent duplicates across different accounts for the same card.
 */
export function migrate032ImproveCardDedupIndex(db: Database.Database): void {
  console.log('[Migration 032] Adding global approval_number unique index to card_transactions...');

  try {
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_card_transactions_dedup_appr
      ON card_transactions(card_company_id, approval_number)
      WHERE approval_number IS NOT NULL AND approval_number != '';
    `);
    console.log('  ✅ Global unique index on (card_company_id, approval_number) created.');
  } catch (error: any) {
    console.error('  ❌ Migration 032 failed:', error.message);
    throw error;
  }
}
