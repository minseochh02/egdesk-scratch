const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.env.APPDATA, 'egdesk', 'database', 'financehub.db');
const db = new Database(dbPath);

const accountId = '99a59ce3-847f-4a10-aebb-4e018605a8ea';

console.log(`Checking transactions for account: ${accountId}`);

// 1. Check counts
const totalCount = db.prepare('SELECT count(*) as count FROM bank_transactions WHERE account_id = ?').get(accountId);
console.log(`Total bank_transactions for this account: ${totalCount.count}`);

// 2. Search for the specific amount 15
const rows = db.prepare(`
  SELECT * FROM bank_transactions 
  WHERE account_id = ? 
  AND (deposit = 15 OR withdrawal = 15)
`).all(accountId);

console.log('--- Transactions with amount 15 ---');
if (rows.length === 0) {
    console.log('No transactions with amount 15 found.');
} else {
    rows.forEach(row => {
        console.log(`ID: ${row.id}`);
        console.log(`Date: ${row.transaction_date}`);
        console.log(`Time: ${row.transaction_time}`);
        console.log(`Datetime: [${row.transaction_datetime}]`);
        console.log(`Deposit: ${row.deposit}`);
        console.log(`Withdrawal: ${row.withdrawal}`);
        console.log(`Balance: ${row.balance}`);
        console.log(`Desc: ${row.description}`);
        console.log('-------------------');
    });
}

// 3. Check for any transactions with empty datetime
const emptyDtRows = db.prepare(`
  SELECT count(*) as count FROM bank_transactions 
  WHERE account_id = ? AND (transaction_datetime IS NULL OR transaction_datetime = '')
`).get(accountId);
console.log(`Rows with empty datetime: ${emptyDtRows.count}`);

db.close();
