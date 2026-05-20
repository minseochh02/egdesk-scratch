const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'egdesk', 'database', 'financehub.db');
const db = new Database(dbPath, { readonly: true });

try {
  console.log('=== 2차 마이그레이션 결과 최종 통계 확인 ===');
  
  // 1. 대시가 포함되어 있는 하나, 기업, 우리은행 계좌 개수 조회
  const updatedAccounts = db.prepare(`
    SELECT bank_id, COUNT(*) as count 
    FROM accounts 
    WHERE bank_id IN ('hana', 'ibk', 'woori') AND account_number LIKE '%-%'
    GROUP BY bank_id
  `).all();
  console.log('대시 적용된 계좌 통계:');
  console.table(updatedAccounts);

  // 2. 전체 계좌 개수
  const totalAccounts = db.prepare("SELECT COUNT(*) as count FROM accounts").all()[0].count;
  console.log(`현재 총 계좌 개수: ${totalAccounts}개`);

  // 3. 거래내역 중 대시 포맷을 가진 거래들의 수
  const bankTxsCount = db.prepare(`
    SELECT acc.bank_id, COUNT(*) as count
    FROM bank_transactions tx
    JOIN accounts acc ON tx.account_id = acc.id
    WHERE tx.account_number LIKE '%-%' AND acc.bank_id IN ('hana', 'ibk', 'woori')
    GROUP BY acc.bank_id
  `).all();
  console.log('\n대시 적용된 거래 내역(bank_transactions) 통계:');
  console.table(bankTxsCount);

} catch (e) {
  console.error('오류 발생:', e.message);
} finally {
  db.close();
}
