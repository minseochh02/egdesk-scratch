import Database from 'better-sqlite3';

/**
 * Migration 026: Update card_transactions deduplication index and Remap existing data
 * 
 * 1. Remaps existing card transactions to correct accounts based on card_number
 * 2. Deletes duplicate transactions that appear after remapping
 * 3. Updates the unique index to include account_id
 */
export function migrate026UpdateCardDedupIndex(db: Database.Database): void {
  console.log('[Migration 026] Starting comprehensive card data remapping and index update...');

  try {
    // 1. Get all BC Card accounts to create a mapping map
    const accounts = db.prepare("SELECT id, account_number FROM accounts WHERE bank_id = 'bc-card'").all() as { id: string, account_number: string }[];
    
    // Create a map for quick lookup: last6 -> accountId
    const accountMap = new Map<string, string>();
    accounts.forEach(acc => {
      const cleaned = acc.account_number.replace(/[^\d]/g, '');
      const last6 = cleaned.slice(-6);
      if (last6) accountMap.set(last6, acc.id);
    });

    console.log(`  🔍 Found ${accounts.length} BC Card accounts for remapping.`);

    // 2. Remap transactions based on their card_number field
    console.log('  🔄 Remapping existing transactions to correct accounts...');
    
    // Get all BC Card transactions that have a card_number
    const transactions = db.prepare(`
      SELECT id, card_number, account_id 
      FROM card_transactions 
      WHERE card_company_id = 'bc-card' AND card_number IS NOT NULL AND card_number != ''
    `).all() as { id: string, card_number: string, account_id: string }[];

    let remappedCount = 0;
    const updateStmt = db.prepare("UPDATE card_transactions SET account_id = ? WHERE id = ?");

    db.transaction(() => {
      for (const tx of transactions) {
        const cleaned = tx.card_number.replace(/[^\d]/g, '');
        const last6 = cleaned.slice(-6);
        const correctAccountId = accountMap.get(last6);

        if (correctAccountId && correctAccountId !== tx.account_id) {
          updateStmt.run(correctAccountId, tx.id);
          remappedCount++;
        }
      }
    })();
    console.log(`  ✅ Remapped ${remappedCount} transactions to their correct accounts.`);

    // 3. Delete duplicates that might have been created by remapping
    // We group by (account_id, approval_datetime, merchant_name, amount) and keep only the oldest row (lowest ROWID or id)
    console.log('  🧹 Removing duplicate transactions created after remapping...');
    const deleteDupesResult = db.exec(`
      DELETE FROM card_transactions
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM card_transactions
        GROUP BY account_id, approval_datetime, merchant_name, amount
      )
    `);
    console.log('  ✅ Cleanup of duplicate transactions complete.');

    // 4. Drop and Recreate Index
    console.log('  🏗️ Updating unique index...');
    db.exec(`DROP INDEX IF EXISTS idx_card_transactions_dedup`);
    db.exec(`
      CREATE UNIQUE INDEX idx_card_transactions_dedup
      ON card_transactions(account_id, approval_datetime, merchant_name, amount);
    `);
    console.log('  ✅ New UNIQUE index created with account_id.');

    console.log('[Migration 026] Successfully completed.');
  } catch (error: any) {
    console.error('  ❌ Migration 026 failed:', error.message);
    throw error;
  }
}
