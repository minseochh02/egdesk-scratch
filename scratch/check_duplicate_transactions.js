const Database = require('better-sqlite3');
const dbPath = 'C:\\Users\\user\\AppData\\Roaming\\egdesk\\database\\financehub.db';

try {
  const db = new Database(dbPath, { fileMustExist: true });
  console.log('🧪 [중복 거래 스캔] bank_transactions 테이블 스캔을 시작합니다...');

  // 1. bank_transactions 테이블 중복 조회
  // 동일한 account_id 내에서 transaction_datetime, deposit, withdrawal, balance가 일치하는 거래가 2번 이상 있는지 체크
  const dupBankTxs = db.prepare(`
    SELECT account_id, transaction_datetime, deposit, withdrawal, balance, COUNT(*) as cnt
    FROM bank_transactions
    GROUP BY account_id, transaction_datetime, deposit, withdrawal, balance
    HAVING cnt > 1
  `).all();

  console.log(`\n========================================`);
  console.log(`🚨 [결과] bank_transactions 중복 그룹 수: ${dupBankTxs.length}개`);
  
  if (dupBankTxs.length > 0) {
    let totalDups = 0;
    dupBankTxs.forEach((group, idx) => {
      totalDups += (group.cnt - 1);
      
      // 계좌 정보 조회
      const acc = db.prepare('SELECT account_number, account_name, bank_id FROM accounts WHERE id = ?').get(group.account_id);
      const bankName = acc ? `${acc.bank_id.toUpperCase()} (${acc.account_name}, ${acc.account_number})` : '알 수 없는 계좌';
      
      console.log(`[그룹 ${idx + 1}] 계좌: ${bankName}`);
      console.log(`   - 일시: ${group.transaction_datetime}`);
      console.log(`   - 입금액: ${group.deposit.toLocaleString()}원 | 출금액: ${group.withdrawal.toLocaleString()}원 | 잔액: ${group.balance.toLocaleString()}원`);
      console.log(`   - 중복 횟수: ${group.cnt}회 (제거 가능한 잉여 레코드 수: ${group.cnt - 1}개)`);
      
      // 상세 데이터 조회
      const details = db.prepare(`
        SELECT id, counterparty_name, description, created_at 
        FROM bank_transactions 
        WHERE account_id = ? 
          AND transaction_datetime = ? 
          AND deposit = ? 
          AND withdrawal = ? 
          AND balance = ?
      `).all(group.account_id, group.transaction_datetime, group.deposit, group.withdrawal, group.balance);
      
      details.forEach((d, dIdx) => {
        console.log(`     -> 레코드 ${dIdx + 1}: ID=${d.id} | 상대방=${d.counterparty_name} | 적요=${d.description} | 생성일=${d.created_at}`);
      });
    });
    console.log(`\n👉 총 제거 가능한 중복 거래 레코드 수: ${totalDups}개`);
  } else {
    console.log('✅ bank_transactions 테이블에 중복되는 거래 내역이 존재하지 않습니다. 깨끗합니다!');
  }

  console.log('\n========================================');
  console.log('🧪 [중복 거래 스캔] transactions 테이블 스캔을 시작합니다...');

  // 2. transactions 테이블 중복 조회
  const dupTxs = db.prepare(`
    SELECT account_id, transaction_datetime, deposit, withdrawal, balance, COUNT(*) as cnt
    FROM transactions
    GROUP BY account_id, transaction_datetime, deposit, withdrawal, balance
    HAVING cnt > 1
  `).all();

  console.log(`🚨 [결과] transactions 중복 그룹 수: ${dupTxs.length}개`);
  
  if (dupTxs.length > 0) {
    let totalDups = 0;
    dupTxs.forEach((group, idx) => {
      totalDups += (group.cnt - 1);
      const acc = db.prepare('SELECT account_number, account_name, bank_id FROM accounts WHERE id = ?').get(group.account_id);
      const bankName = acc ? `${acc.bank_id.toUpperCase()} (${acc.account_name}, ${acc.account_number})` : '알 수 없는 계좌';
      
      console.log(`[그룹 ${idx + 1}] 계좌: ${bankName}`);
      console.log(`   - 일시: ${group.transaction_datetime}`);
      console.log(`   - 입금액: ${group.deposit.toLocaleString()}원 | 출금액: ${group.withdrawal.toLocaleString()}원 | 잔액: ${group.balance.toLocaleString()}원`);
      console.log(`   - 중복 횟수: ${group.cnt}회 (제거 가능한 잉여 레코드 수: ${group.cnt - 1}개)`);
    });
    console.log(`\n👉 총 제거 가능한 중복 거래 레코드 수: ${totalDups}개`);
  } else {
    console.log('✅ transactions 테이블에 중복되는 거래 내역이 존재하지 않습니다. 깨끗합니다!');
  }

  db.close();
} catch (err) {
  console.error('DB 작업 실패:', err.message);
}
