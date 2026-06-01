// c:\Users\user\Desktop\egdesk-scratch\scratch\check_missing_data.js
// 5월 27일자 중복 충돌을 일으키는 DB 레코드의 상세 조사

const Database = require('better-sqlite3');
const dbPath = 'C:\\Users\\user\\AppData\\Roaming\\egdesk\\database\\financehub.db';
const db = new Database(dbPath, { readonly: true });

try {
  const accountNumber = '306-063568-04-011';
  const account = db.prepare('SELECT * FROM accounts WHERE account_number = ?').get(accountNumber);
  if (!account) {
    console.error(`에러: 계좌를 찾을 수 없습니다.`);
    process.exit(1);
  }
  const accountId = account.id;

  // 1. DB 전체에서 최근 10건 조회
  console.log('--- 1. 최근 저장된 거래 10건 조회 ---');
  const recentTxs = db.prepare(`
    SELECT id, transaction_date, transaction_time, transaction_datetime, withdrawal, deposit, balance, description
    FROM bank_transactions
    WHERE account_id = ?
    ORDER BY created_at DESC, transaction_datetime DESC
    LIMIT 10
  `).all(accountId);
  console.log(recentTxs);

  // 2. 5월 27일자 거래의 충돌 후보 탐색
  // 파싱된 5월 27일 거래의 주요 값들:
  // - 10:52:19, 출금 80000, 잔액 4592754
  // - 10:49:58, 출금 8300000, 잔액 4672754
  // - 10:47:13, 입금 7000000, 잔액 12972754
  console.log('\n--- 2. UNIQUE 충돌 후보 조회 ---');
  const conflictCandidates = db.prepare(`
    SELECT id, transaction_date, transaction_time, transaction_datetime, withdrawal, deposit, balance, description, created_at
    FROM bank_transactions
    WHERE account_id = ? AND (
      (withdrawal = 80000 AND balance = 4592754) OR
      (withdrawal = 8300000 AND balance = 4672754) OR
      (deposit = 7000000 AND balance = 12972754)
    )
  `).all(accountId);
  console.log('충돌 유발 레코드 목록:');
  console.log(conflictCandidates);

  // 3. 날짜 형식이 어떤 식으로 저장되는지 패턴 확인
  console.log('\n--- 3. DB에 저장된 날짜/시간 포맷 통계 ---');
  const dateFormats = db.prepare(`
    SELECT transaction_date, COUNT(*) as cnt
    FROM bank_transactions
    WHERE account_id = ?
    GROUP BY transaction_date
    ORDER BY transaction_date DESC
    LIMIT 10
  `).all(accountId);
  console.log(dateFormats);

} catch (err) {
  console.error(`에러: ${err.message}`);
} finally {
  db.close();
}
