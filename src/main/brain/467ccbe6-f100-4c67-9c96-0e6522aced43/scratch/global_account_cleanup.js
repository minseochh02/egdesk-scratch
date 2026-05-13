const Database = require('better-sqlite3');
const { randomUUID } = require('crypto');

const dbPath = 'C:\\Users\\user\\AppData\\Roaming\\egdesk\\database\\financehub.db';
const db = new Database(dbPath);

function normalize(bankId, acc) {
  let n = acc.replace(/[-\s]/g, '');
  if (bankId === 'kookmin' && n.length === 14 && n.startsWith('246')) n = n.slice(3);
  if (bankId === 'woori' && n.length === 12 && n.startsWith('005')) n = '1' + n;
  return n;
}

const accounts = db.prepare('SELECT * FROM accounts').all();
const groups = {};

accounts.forEach(a => {
  const norm = normalize(a.bank_id, a.account_number);
  const key = `${a.bank_id}:${norm}`;
  if (!groups[key]) groups[key] = [];
  groups[key].push(a);
});

const transaction = db.transaction(() => {
  for (const key in groups) {
    const group = groups[key];
    if (group.length > 1) {
      console.log(`Merging group ${key} (${group.length} accounts)...`);
      // Sort by transaction count or created_at
      const accountsWithCounts = group.map(a => {
        const count = db.prepare('SELECT COUNT(*) as cnt FROM bank_transactions WHERE account_id = ?').get(a.id).cnt;
        return { ...a, count };
      });
      
      accountsWithCounts.sort((a, b) => b.count - a.count);
      const primary = accountsWithCounts[0];
      const duplicates = accountsWithCounts.slice(1);
      
      console.log(`  Primary: ${primary.id} (${primary.account_number}) - ${primary.count} txs`);
      
      for (const dup of duplicates) {
        console.log(`  Duplicate: ${dup.id} (${dup.account_number}) - ${dup.count} txs`);
        
        // Move transactions
        const txs = db.prepare('SELECT * FROM bank_transactions WHERE account_id = ?').all(dup.id);
        const insertStmt = db.prepare(`
          INSERT OR IGNORE INTO bank_transactions (
            id, account_id, bank_id, transaction_date, transaction_time, transaction_datetime,
            account_number, account_name, deposit, withdrawal, balance, branch,
            counterparty_account, counterparty_name, description, description2, memo,
            is_manual, category, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const tx of txs) {
          insertStmt.run(
            randomUUID(), primary.id, tx.bank_id, tx.transaction_date, tx.transaction_time,
            tx.transaction_datetime, tx.account_number, tx.account_name, tx.deposit,
            tx.withdrawal, tx.balance, tx.branch, tx.counterparty_account,
            tx.counterparty_name, tx.description, tx.description2, tx.memo,
            tx.is_manual, tx.category, tx.created_at, tx.updated_at
          );
        }
        
        // Move card transactions if any
        db.prepare('UPDATE card_transactions SET account_id = ? WHERE account_id = ?').run(primary.id, dup.id);
        
        // Delete dup
        db.prepare('DELETE FROM bank_transactions WHERE account_id = ?').run(dup.id);
        db.prepare('DELETE FROM accounts WHERE id = ?').run(dup.id);
      }
      
      // Update primary account number to normalized version
      const normAcc = normalize(primary.bank_id, primary.account_number);
      db.prepare('UPDATE accounts SET account_number = ? WHERE id = ?').run(normAcc, primary.id);
    } else {
      // Normalize single accounts too
      const a = group[0];
      const normAcc = normalize(a.bank_id, a.account_number);
      if (a.account_number !== normAcc) {
        console.log(`Normalizing ${a.bank_id} account ${a.account_number} -> ${normAcc}`);
        db.prepare('UPDATE accounts SET account_number = ? WHERE id = ?').run(normAcc, a.id);
      }
    }
  }
});

try {
  transaction();
  console.log('Global cleanup and normalization complete.');
} catch (e) {
  console.error('Cleanup failed:', e);
} finally {
  db.close();
}
