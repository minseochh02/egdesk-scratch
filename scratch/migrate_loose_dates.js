// c:\Users\user\Desktop\egdesk-scratch\scratch\migrate_loose_dates.js
// 대시가 누락된(YYYYMMDD) 거래 일자를 YYYY-MM-DD 형식으로 교체하는 마이그레이션 스크립트

const Database = require('better-sqlite3');
const dbPath = 'C:\\Users\\user\\AppData\\Roaming\\egdesk\\database\\financehub.db';

console.log(`[마이그레이션] DB 연결 중: ${dbPath}`);
const db = new Database(dbPath);

try {
  // 1. 마이그레이션 대상 데이터 통계 조회
  console.log('\n--- 1. 마이그레이션 대상 날짜 조회 ---');
  
  // YYYYMMDD 형태 (길이가 8자리이고 숫자로만 이루어진 경우)의 날짜 분포 분석
  const targets = db.prepare(`
    SELECT transaction_date, COUNT(*) as cnt
    FROM bank_transactions
    WHERE LENGTH(transaction_date) = 8 AND transaction_date GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
    GROUP BY transaction_date
    ORDER BY transaction_date DESC
  `).all();

  console.log(`마이그레이션 대상 그룹 수: ${targets.length}개`);
  console.log(targets);

  const totalTargetCount = targets.reduce((sum, item) => sum + item.cnt, 0);
  console.log(`총 대상 레코드 수: ${totalTargetCount}건`);

  if (totalTargetCount === 0) {
    console.log('마이그레이션 대상 데이터가 없습니다. 이미 모두 정상 포맷이거나 대상이 없습니다.');
    db.close();
    process.exit(0);
  }

  // 2. 트랜잭션을 걸어 마이그레이션 수행
  console.log('\n--- 2. 마이그레이션 실행 중 ---');
  
  const updateStmt = db.prepare(`
    UPDATE bank_transactions
    SET transaction_date = ?
    WHERE transaction_date = ?
  `);

  const runMigration = db.transaction(() => {
    let updatedGroups = 0;
    let updatedRows = 0;

    for (const group of targets) {
      const oldDate = group.transaction_date;
      // YYYYMMDD -> YYYY-MM-DD 변환
      const newDate = oldDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
      
      console.log(`- 변환 처리: ${oldDate} -> ${newDate} (${group.cnt}건)`);
      const result = updateStmt.run(newDate, oldDate);
      
      updatedRows += result.changes;
      updatedGroups++;
    }

    return { updatedGroups, updatedRows };
  });

  const summary = runMigration();
  console.log(`\n✅ 마이그레이션 완료: ${summary.updatedGroups}개 날짜 그룹, 총 ${summary.updatedRows}개 행 업데이트됨.`);

  // 3. 결과 검증을 위한 날짜 분포 최종 확인
  console.log('\n--- 3. 마이그레이션 이후 날짜 포맷 통계 ---');
  const finalStats = db.prepare(`
    SELECT transaction_date, COUNT(*) as cnt
    FROM bank_transactions
    GROUP BY transaction_date
    ORDER BY transaction_date DESC
    LIMIT 15
  `).all();
  console.log(finalStats);

} catch (err) {
  console.error(`❌ 마이그레이션 오류 발생: ${err.message}`);
} finally {
  db.close();
}
