const Database = require('better-sqlite3');
const dbPath = 'C:\\Users\\user\\AppData\\Roaming\\egdesk\\database\\financehub.db';

try {
  const db = new Database(dbPath, { fileMustExist: true });
  console.log('🧪 [교차 계좌 중복 스캔] 국민은행(KB) 계좌 간 중복 거래 내역 스캔을 시작합니다...');

  // 국민은행 계좌 정보 가져오기
  const kbAccounts = db.prepare("SELECT * FROM accounts WHERE bank_id = 'kookmin'").all();
  console.log(`- 검색된 국민은행 계좌 수: ${kbAccounts.length}개`);
  kbAccounts.forEach(a => {
    console.log(`  * ID: ${a.id} | 계좌명: ${a.account_name} | 계좌번호: ${a.account_number}`);
  });

  // 서로 다른 계좌(account_id가 다른 레코드) 간에 
  // transaction_datetime, deposit, withdrawal, balance가 동일한 거래가 존재하는지 조회
  const crossDups = db.prepare(`
    SELECT transaction_datetime, deposit, withdrawal, balance, COUNT(DISTINCT account_id) as acc_count, COUNT(*) as total_count
    FROM bank_transactions
    WHERE bank_id = 'kookmin'
    GROUP BY transaction_datetime, deposit, withdrawal, balance
    HAVING acc_count > 1
  `).all();

  console.log(`\n========================================`);
  console.log(`🚨 [결과] 서로 다른 국민은행 계좌 간 중복 거래 패턴 수: ${crossDups.length}개`);

  if (crossDups.length > 0) {
    crossDups.forEach((group, idx) => {
      console.log(`\n[중복 패턴 ${idx + 1}]`);
      console.log(`   - 일시: ${group.transaction_datetime}`);
      console.log(`   - 입금액: ${group.deposit.toLocaleString()}원 | 출금액: ${group.withdrawal.toLocaleString()}원 | 잔액: ${group.balance.toLocaleString()}원`);
      console.log(`   - 중복된 계좌 수: ${group.acc_count}개 | 총 거래 레코드 수: ${group.total_count}개`);

      // 해당 패턴을 가진 구체적인 레코드들을 계좌명과 함께 출력
      const details = db.prepare(`
        SELECT bt.id, bt.account_id, bt.counterparty_name, bt.description, bt.created_at, a.account_number, a.account_name
        FROM bank_transactions bt
        JOIN accounts a ON bt.account_id = a.id
        WHERE bt.bank_id = 'kookmin'
          AND bt.transaction_datetime = ?
          AND bt.deposit = ?
          AND bt.withdrawal = ?
          AND bt.balance = ?
      `).all(group.transaction_datetime, group.deposit, group.withdrawal, group.balance);

      details.forEach((d, dIdx) => {
        console.log(`     -> 레코드 ${dIdx + 1}: 계좌번호=${d.account_number} (${d.account_name}) | ID=${d.id} | 상대방=${d.counterparty_name} | 적요=${d.description}`);
      });
    });
  } else {
    console.log('✅ 서로 다른 국민은행 계좌 간에 중복(복제)된 거래 내역은 존재하지 않습니다. 아주 깨끗합니다!');
  }

  // 이번엔 전체 은행 계좌들을 대상으로도 넓혀서 교차 계좌 중복이 있는지 확인
  console.log('\n========================================');
  console.log('🧪 [확장 스캔] 은행 구분 없이 전체 DB의 서로 다른 계좌 간 동일 거래가 있는지 확인합니다...');

  const globalCrossDups = db.prepare(`
    SELECT transaction_datetime, deposit, withdrawal, balance, COUNT(DISTINCT account_id) as acc_count, COUNT(*) as total_count
    FROM bank_transactions
    GROUP BY transaction_datetime, deposit, withdrawal, balance
    HAVING acc_count > 1
  `).all();

  console.log(`🚨 [결과] 전체 DB의 서로 다른 계좌 간 동일 거래 패턴 수: ${globalCrossDups.length}개`);

  if (globalCrossDups.length > 0) {
    let outputCount = 0;
    globalCrossDups.forEach((group, idx) => {
      // 10원 미만의 소액이나 0원 거래 등 우연의 일치일 가능성이 있는 것들을 위해, 
      // 입금/출금 금액이 0원이 아닌 유의미한 거래만 모니터링하거나 상세 리스팅합니다.
      if (group.deposit === 0 && group.withdrawal === 0) return; // 0원 거래는 생략
      outputCount++;

      if (outputCount <= 5) { // 너무 많을 수 있으므로 상위 5개만 상세 출력
        console.log(`\n[글로벌 중복 패턴 ${outputCount}]`);
        console.log(`   - 일시: ${group.transaction_datetime}`);
        console.log(`   - 입금액: ${group.deposit.toLocaleString()}원 | 출금액: ${group.withdrawal.toLocaleString()}원 | 잔액: ${group.balance.toLocaleString()}원`);
        
        const details = db.prepare(`
          SELECT bt.account_id, a.account_number, a.account_name, a.bank_id
          FROM bank_transactions bt
          JOIN accounts a ON bt.account_id = a.id
          WHERE bt.transaction_datetime = ?
            AND bt.deposit = ?
            AND bt.withdrawal = ?
            AND bt.balance = ?
        `).all(group.transaction_datetime, group.deposit, group.withdrawal, group.balance);

        details.forEach(d => {
          console.log(`     -> 계좌: ${d.bank_id.toUpperCase()} | 번호: ${d.account_number} (${d.account_name})`);
        });
      }
    });
    console.log(`\n👉 총 ${globalCrossDups.length}개의 동일 금액/시간대 거래가 여러 계좌에 존재합니다. (시간과 금액, 잔액이 우연히 일치한 정상 거래 혹은 내부 대체거래일 수 있습니다.)`);
  } else {
    console.log('✅ 전체 계좌 간 중복 거래가 존재하지 않습니다.');
  }

  db.close();
} catch (err) {
  console.error('DB 작업 실패:', err.message);
}
