import Database from 'better-sqlite3';

/**
 * Migration 034: Ensure dropped card_transactions deduplication index
 * 
 * Ensures the overly restrictive global unique index on (card_company_id, approval_number)
 * is dropped, resolving the migration ordering issue where Migration 032 was applied 
 * after Migration 033.
 */
export function migrate034EnsureDroppedCardDedupIndex(db: Database.Database): void {
  console.log('[Migration 034] Ensuring buggy global approval_number unique index is dropped...');

  try {
    db.exec(`
      DROP INDEX IF EXISTS idx_card_transactions_dedup_appr;
    `);
    console.log('  ✅ Buggy index idx_card_transactions_dedup_appr successfully dropped in Migration 034.');
  } catch (error: any) {
    console.error('  ❌ Migration 034 failed:', error.message);
    throw error;
  }
}
