const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join('C:', 'Users', 'user', 'AppData', 'Roaming', 'egdesk', 'database', 'financehub.db');
console.log('DB Path:', dbPath);

let db;
try {
  db = new Database(dbPath, { readonly: true });
} catch (err) {
  console.error('Failed to open database:', err.message);
  process.exit(1);
}

try {
  // 1. Find all accounts
  console.log('\n--- Accounts in Database ---');
  const accounts = db.prepare('SELECT id, bank_id, account_number, account_name FROM accounts').all();
  accounts.forEach(acc => {
    console.log(`ID: ${acc.id} | Bank: ${acc.bank_id} | Num: ${acc.account_number} | Name: ${acc.account_name}`);
  });

  // 2. Query transactions for '306-063568-04-075' specifically or any IBK accounts
  console.log('\n--- Querying transactions for 306-063568-04-075 ---');
  const account075 = accounts.find(a => a.account_number.includes('04-075') || a.account_number.includes('075'));
  if (account075) {
    console.log('Found targeted account:', account075);
    const txs = db.prepare('SELECT * FROM bank_transactions WHERE account_id = ? ORDER BY transaction_date DESC').all(account075.id);
    console.log(`Total transactions for this account: ${txs.length}`);
    txs.forEach(t => {
      console.log(`  Date: ${t.transaction_date} ${t.transaction_time} | Dep: ${t.deposit} | With: ${t.withdrawal} | Bal: ${t.balance} | Desc: ${t.description} | Memo: ${t.memo}`);
    });
  } else {
    console.log('Targeted account (04-075) not found in accounts table.');
  }

  // 3. Query any manual transactions or any transactions with date in 2022
  console.log('\n--- Querying 2022 Transactions in DB ---');
  const txs2022 = db.prepare("SELECT * FROM bank_transactions WHERE transaction_date LIKE '2022%'").all();
  console.log(`Total 2022 transactions: ${txs2022.length}`);
  txs2022.forEach(t => {
    console.log(`  AccountNum: ${t.account_number} (${t.account_id}) | Date: ${t.transaction_date} | Dep: ${t.deposit} | With: ${t.withdrawal} | Desc: ${t.description}`);
  });

} catch (err) {
  console.error('Error querying DB:', err.message);
} finally {
  db.close();
}



