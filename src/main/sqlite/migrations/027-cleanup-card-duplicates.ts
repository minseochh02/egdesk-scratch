import Database from 'better-sqlite3';

/**
 * Migration 027: Cleanup duplicate card transactions across different accounts
 * 
 * This migration finds transactions that have the same (approval_datetime, merchant_name, amount)
 * but are assigned to different accounts, and deletes the duplicates.
 * It prefers keeping transactions in "real" accounts over "manual upload" or "catch-all" accounts.
 */
export function migrate027CleanupCardDuplicates(db: Database.Database): void {
  console.log('[Migration 027] Starting card transaction duplicate cleanup...');

  try {
    // 1. Identify duplicates across accounts using all() to avoid "busy" error
    const duplicates = db.prepare(`
      SELECT approval_datetime, merchant_name, amount, COUNT(*) as count
      FROM card_transactions
      GROUP BY approval_datetime, merchant_name, amount
      HAVING count > 1
    `).all();

    console.log(`  🔍 Processing duplicate transactions...`);

    let totalDeleted = 0;
    let setsProcessed = 0;

    db.transaction(() => {
      for (const dup of duplicates as any[]) {
        setsProcessed++;
        // Get all instances of this transaction
        const instances = db.prepare(`
          SELECT ct.id, ct.account_id, a.account_name, ct.created_at
          FROM card_transactions ct
          JOIN accounts a ON ct.account_id = a.id
          WHERE ct.approval_datetime = ? AND ct.merchant_name = ? AND ct.amount = ?
          ORDER BY 
            -- Prefer "real" accounts over catch-all or manual upload accounts
            CASE 
              WHEN a.account_name LIKE '%수동%' OR a.account_name LIKE '%통합%' THEN 2
              ELSE 1
            END ASC,
            ct.created_at ASC
        `).all(dup.approval_datetime, dup.merchant_name, dup.amount) as { id: string, account_id: string, account_name: string }[];

        if (instances.length > 1) {
          // Keep the first one (the "best" one according to our ORDER BY), delete the rest
          const idsToDelete = instances.slice(1).map(i => i.id);
          
          const deleteStmt = db.prepare("DELETE FROM card_transactions WHERE id = ?");
          for (const id of idsToDelete) {
            deleteStmt.run(id);
            totalDeleted++;
          }
        }
      }
    })();

    console.log(`  ✅ Processed ${setsProcessed} duplicate sets, deleted ${totalDeleted} transactions.`);
    console.log('[Migration 027] Successfully completed.');
  } catch (error: any) {
    console.error('  ❌ Migration 027 failed:', error.message);
    throw error;
  }
}
