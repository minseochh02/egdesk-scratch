import Database from 'better-sqlite3';

/**
 * Migration 033: Drop incorrect card_transactions deduplication index
 * 
 * Drops the overly restrictive global unique index on (card_company_id, approval_number)
 * which caused massive data loss by treating identical approval numbers across different cards
 * as duplicates.
 */
export function migrate033DropIncorrectCardDedupIndex(db: Database.Database): void {
  console.log('[Migration 033] Dropping incorrect global approval_number unique index from card_transactions...');

  try {
    db.exec(`
      DROP INDEX IF EXISTS idx_card_transactions_dedup_appr;
    `);
    console.log('  ✅ Incorrect unique index idx_card_transactions_dedup_appr successfully dropped.');
  } catch (error: any) {
    console.error('  ❌ Migration 033 failed:', error.message);
    throw error;
  }
}
