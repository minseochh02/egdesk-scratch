const Database = require('better-sqlite3');
const dbPath = 'C:\\Users\\user\\AppData\\Roaming\\egdesk\\database\\financehub.db';

try {
  const db = new Database(dbPath, { fileMustExist: true });
  console.log('--- accounts 테이블 스키마 ---');
  const columns = db.prepare('PRAGMA table_info(accounts)').all();
  columns.forEach(c => {
    console.log(`컬럼명: ${c.name}, 타입: ${c.type}`);
  });

  const accounts = db.prepare(`
    SELECT * 
    FROM accounts 
    WHERE account_number LIKE '%669%' 
       OR account_number LIKE '%116%' 
       OR account_number LIKE '%573291%'
       OR account_number LIKE '%246%'
       OR account_number LIKE '%165951%'
       OR account_number LIKE '%601%'
  `).all();
  
  console.log(`\naccounts 테이블 검색 결과 (${accounts.length}개):`);
  accounts.forEach(r => {
    console.log(JSON.stringify(r));
  });

  console.log('\n--- bank_transactions 테이블 검색 ---');
  const txs = db.prepare(`
    SELECT DISTINCT account_number 
    FROM bank_transactions 
    WHERE account_number LIKE '%669%' 
       OR account_number LIKE '%116%' 
       OR account_number LIKE '%573291%'
       OR account_number LIKE '%246%'
       OR account_number LIKE '%165951%'
       OR account_number LIKE '%601%'
  `).all();
  
  console.log(`bank_transactions 테이블 검색 결과 (${txs.length}개):`);
  txs.forEach(r => {
    console.log(`계좌번호: ${r.account_number}`);
  });

  db.close();
} catch (err) {
  console.error('DB 작업 실패:', err.message);
  process.exit(1);
}
