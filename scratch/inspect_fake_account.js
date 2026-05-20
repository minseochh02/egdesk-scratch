const Database = require('better-sqlite3');
const dbPath = 'C:\\Users\\user\\AppData\\Roaming\\egdesk\\database\\financehub.db';

try {
  const db = new Database(dbPath, { fileMustExist: true });
  const accountId = '35ff1d94-f09e-416a-9424-2434ee7094a0';
  const accountNumber = '1000000000000';
  
  console.log(`--- [계좌조회] ${accountNumber} (ID: ${accountId}) ---`);
  
  // 1. bank_transactions 조회
  const bankTxs = db.prepare(`
    SELECT * FROM bank_transactions WHERE account_id = ? OR account_number = ?
  `).all(accountId, accountNumber);
  console.log(`- bank_transactions 테이블 내 연동 거래 수: ${bankTxs.length}건`);
  bankTxs.forEach(t => {
    console.log(JSON.stringify(t));
  });
  
  // 2. transactions 조회
  const txs = db.prepare(`
    SELECT COUNT(*) as count FROM transactions WHERE account_id = ?
  `).get(accountId);
  console.log(`- transactions 테이블 내 연동 거래 수: ${txs.count}건`);

  // 3. sync_operations 조회
  const syncs = db.prepare(`
    SELECT COUNT(*) as count FROM sync_operations WHERE account_id = ?
  `).get(accountId);
  console.log(`- sync_operations 테이블 내 작업 수: ${syncs.count}건`);

  // 4. card_transactions 조회
  const cardTxs = db.prepare(`
    SELECT COUNT(*) as count FROM card_transactions WHERE account_id = ?
  `).get(accountId);
  console.log(`- card_transactions 테이블 내 연동 거래 수: ${cardTxs.count}건`);

  db.close();
} catch (err) {
  console.error('DB 작업 실패:', err.message);
}
