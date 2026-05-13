const Database = require('better-sqlite3');
const { randomUUID } = require('crypto');

const dbPath = 'C:\\Users\\user\\AppData\\Roaming\\egdesk\\database\\financehub.db';
const db = new Database(dbPath);

const primaryId = 'b1226e9f-605f-4194-b70b-d1533392b709';
const duplicateId = 'a3d1ceea-608f-4c42-96ba-c8be1c3938c2';

console.log(`Merging account ${duplicateId} into ${primaryId}...`);

const transaction = db.transaction(() => {
  // 1. Get transactions from duplicate account
  const txs = db.prepare('SELECT * FROM bank_transactions WHERE account_id = ?').all(duplicateId);
  console.log(`Found ${txs.length} transactions in duplicate account.`);

  let inserted = 0;
  let skipped = 0;

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO bank_transactions (
      id, account_id, bank_id,
      transaction_date, transaction_time, transaction_datetime,
      account_number, account_name,
      deposit, withdrawal, balance,
      branch, counterparty_account, counterparty_name,
      description, description2, memo, is_manual,
      category, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const tx of txs) {
    const result = insertStmt.run(
      randomUUID(),
      primaryId,
      tx.bank_id,
      tx.transaction_date,
      tx.transaction_time,
      tx.transaction_datetime,
      tx.account_number,
      tx.account_name,
      tx.deposit,
      tx.withdrawal,
      tx.balance,
      tx.branch,
      tx.counterparty_account,
      tx.counterparty_name,
      tx.description,
      tx.description2,
      tx.memo,
      tx.is_manual,
      tx.category,
      tx.created_at,
      tx.updated_at
    );

    if (result.changes > 0) {
      inserted++;
    } else {
      skipped++;
    }
  }

  console.log(`Moved ${inserted} transactions, skipped ${skipped} duplicates.`);

  // 2. Delete from duplicate account
  db.prepare('DELETE FROM bank_transactions WHERE account_id = ?').run(duplicateId);
  db.prepare('DELETE FROM accounts WHERE id = ?').run(duplicateId);

  console.log('Cleanup complete.');
});

try {
  transaction();
  console.log('Successfully merged accounts and cleaned up duplicates.');
} catch (error) {
  console.error('Failed to merge accounts:', error);
} finally {
  db.close();
}
