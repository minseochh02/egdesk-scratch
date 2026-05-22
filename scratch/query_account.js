const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = 'c:/Users/user/Desktop/egdesk-scratch/financehub.db';
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // 1. 해당 계좌 정보 조회
  console.log('--- Account Info in bank_accounts ---');
  db.all("SELECT * FROM bank_accounts WHERE account_number LIKE '%306-063568-94-002%' OR account_number LIKE '%30606356894002%'", [], (err, rows) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log(JSON.stringify(rows, null, 2));
  });

  // 2. 해당 계좌의 거래 내역 조회
  console.log('\n--- Transactions for this account ---');
  db.all("SELECT * FROM bank_transactions WHERE account_number LIKE '%306-063568-94-002%' OR account_number LIKE '%30606356894002%' LIMIT 10", [], (err, rows) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log(JSON.stringify(rows, null, 2));
  });
});

db.close();
