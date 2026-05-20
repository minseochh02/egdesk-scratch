const Database = require('better-sqlite3');
const dbPath = 'C:\\Users\\user\\AppData\\Roaming\\egdesk\\database\\financehub.db';

try {
  const db = new Database(dbPath, { fileMustExist: true });
  
  // KB기업종합통장 (b1226e9f-605f-4194-b70b-d1533392b709)의 모든 거래 리스트 조회
  const kbBizTxs = db.prepare(`
    SELECT transaction_datetime, deposit, withdrawal, balance, counterparty_name, description 
    FROM bank_transactions 
    WHERE account_id = 'b1226e9f-605f-4194-b70b-d1533392b709'
    ORDER BY transaction_datetime ASC
  `).all();
  
  console.log(`🏦 KB기업종합통장 (246601-04-165951) 거래 내역 (${kbBizTxs.length}건):`);
  kbBizTxs.forEach((t, idx) => {
    console.log(`[${idx + 1}] ${t.transaction_datetime} | 입금: ${t.deposit.toLocaleString()} | 출금: ${t.withdrawal.toLocaleString()} | 잔액: ${t.balance.toLocaleString()} | 상대방: ${t.counterparty_name} | 적요: ${t.description}`);
  });

  db.close();
} catch (err) {
  console.error('DB 작업 실패:', err.message);
}
