const Database = require('better-sqlite3');
const dbPath = 'C:\\Users\\user\\AppData\\Roaming\\egdesk\\database\\financehub.db';

try {
  const db = new Database(dbPath, { fileMustExist: true });
  console.log('=== 075 ACCOUNT IN DB ===');
  const account = db.prepare("SELECT * FROM accounts WHERE account_number LIKE '%075%'").all();
  console.log(JSON.stringify(account, null, 2));

  console.log('\n=== TRANSACTIONS FOR 075 ===');
  const txs = db.prepare("SELECT * FROM bank_transactions WHERE account_number LIKE '%075%'").all();
  console.log('Transactions Count:', txs.length);
  if (txs.length > 0) {
    console.log('First 2 transactions:', JSON.stringify(txs.slice(0, 2), null, 2));
  }
  db.close();
} catch (err) {
  console.error('Failed to read DB:', err);
}
