const Database = require('better-sqlite3');
const dbPath = 'C:\\Users\\user\\AppData\\Roaming\\egdesk\\database\\financehub.db';

try {
  const db = new Database(dbPath, { fileMustExist: true });
  console.log('--- bank_transactions 테이블에서 관련 계좌번호 패턴 스캔 ---');
  
  const rows = db.prepare(`
    SELECT DISTINCT account_number 
    FROM bank_transactions 
    WHERE account_number LIKE '%116%' 
       OR account_number LIKE '%669%' 
       OR account_number LIKE '%601%' 
       OR account_number LIKE '%246%'
       OR account_number LIKE '%573291%'
  `).all();
  
  console.log(`조회 결과 (${rows.length}개):`);
  rows.forEach(r => {
    console.log(`거래 내역 내 계좌번호: ${r.account_number}`);
  });
  
  db.close();
} catch (err) {
  console.error('DB 작업 실패:', err.message);
  process.exit(1);
}
