const Database = require('better-sqlite3');
const dbPath = 'C:\\Users\\user\\AppData\\Roaming\\egdesk\\database\\financehub.db';

try {
  const db = new Database(dbPath, { fileMustExist: true });
  console.log('🧪 [한도/메타데이터 조회] ibk 및 hana 계좌의 데이터를 조회합니다...');

  const accounts = db.prepare(`
    SELECT id, bank_id, account_number, account_name, balance, metadata 
    FROM accounts 
    WHERE bank_id IN ('ibk', 'hana')
  `).all();

  console.log(`- 조회된 계좌 수: ${accounts.length}개`);
  accounts.forEach((a, idx) => {
    console.log(`\n[${idx + 1}] 은행: ${a.bank_id.toUpperCase()}`);
    console.log(`    - 계좌명: ${a.account_name}`);
    console.log(`    - 계좌번호: ${a.account_number}`);
    console.log(`    - 잔액: ${a.balance.toLocaleString()}원`);
    console.log(`    - 메타데이터: ${a.metadata}`);
  });

  db.close();
} catch (err) {
  console.error('DB 작업 실패:', err.message);
}
