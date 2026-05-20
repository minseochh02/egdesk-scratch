const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 1. 데이터베이스 경로 설정
const dbDir = path.join(process.env.APPDATA, 'egdesk', 'database');
const dbPath = path.join(dbDir, 'financehub.db');
const backupPath = path.join(dbDir, 'financehub.db.bak');

console.log('🔄 계좌 마이그레이션 작업을 시작합니다.');
console.log(`- 대상 DB: ${dbPath}`);
console.log(`- 백업 DB: ${backupPath}`);

// 2. DB 백업 생성
try {
  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, backupPath);
    console.log('✅ 데이터베이스 백업이 안전하게 생성되었습니다.');
  } else {
    console.error('❌ 에러: 데이터베이스 파일이 존재하지 않습니다.');
    process.exit(1);
  }
} catch (e) {
  console.error('❌ 데이터베이스 백업 중 오류 발생:', e.message);
  process.exit(1);
}

const db = new Database(dbPath);

// 마이그레이션 전 기존에 이미 깨져 있던 외래 키 목록 수집
let preExistingFkErrors = new Set();
try {
  const initialFkErrors = db.prepare('PRAGMA foreign_key_check').all();
  for (const err of initialFkErrors) {
    preExistingFkErrors.add(`${err.table}_${err.rowid}`);
  }
  console.log(`ℹ️ [사전 체크] 기존 DB에 이미 존재하는 외래 키 위반: ${initialFkErrors.length}건 (무시 대상)`);
} catch (e) {
  console.warn('⚠️ 사전 외래 키 체크 실패 (무시하고 진행):', e.message);
}

// 3. 마이그레이션 매핑 정의 (모든 최종 계좌번호는 대시 포함 형태인 dash ones로 변경)
const migrationMapping = [
  {
    bank: 'shinhan',
    mainId: '7b5b6099-31d7-4e26-99b6-4ca8db4154c2',
    mainNumber: '140-007-770451',
    subId: '4dba2764-72bc-45aa-8db5-3b9d58f33e85',
    subNumber: '140007770451'
  },
  {
    bank: 'kookmin',
    mainId: 'b1226e9f-605f-4194-b70b-d1533392b709',
    mainNumber: '601-04-165951',
    subId: '0fe3f58d-58b8-4638-8036-cd7747055087',
    subNumber: '60104165951'
  },
  {
    bank: 'hana',
    mainId: '80adbf90-4733-4eeb-9ee3-8d1f11ecac72',
    mainNumber: '213-890060-03204', // 하나은행은 메인에 대시를 적용
    subId: '47cbd88a-6fa5-45de-959c-1a0de604c058',
    subNumber: '213-890060-03204'
  },
  {
    bank: 'nh',
    mainId: '843bfd85-d580-4c79-9cd0-8809281b64bf',
    mainNumber: '301-0056-2119-31',
    subId: '06215515-45e7-451d-8d35-96133fa2619c',
    subNumber: '3010056211931'
  }
];

// 트랜잭션 내부에서 마이그레이션 실행
const runMigration = db.transaction(() => {
  console.log('\n🔐 데이터베이스 트랜잭션을 시작합니다...');

  for (const mapping of migrationMapping) {
    console.log(`\n========================================`);
    console.log(`🏦 은행: ${mapping.bank.toUpperCase()}`);
    console.log(`👉 Main ID: ${mapping.mainId} | 번호: ${mapping.mainNumber}`);
    console.log(`👉 Sub ID:  ${mapping.subId} | 번호: ${mapping.subNumber}`);

    // A. bank_transactions 중복 제거 및 이관
    console.log('\n[1/5] bank_transactions 마이그레이션 및 중복 제거 중...');
    
    // 메인의 기존 거래 내역 고유 키 수집
    const mainBankTxs = db.prepare(`
      SELECT transaction_datetime, deposit, withdrawal, balance 
      FROM bank_transactions 
      WHERE account_id = ?
    `).all(mapping.mainId);

    const makeKey = (tx) => `${tx.transaction_datetime}_${tx.deposit}_${tx.withdrawal}_${tx.balance}`;
    const mainTxKeys = new Set(mainBankTxs.map(makeKey));

    // 서브의 거래 내역 조회
    const subBankTxs = db.prepare(`
      SELECT id, transaction_datetime, deposit, withdrawal, balance 
      FROM bank_transactions 
      WHERE account_id = ?
    `).all(mapping.subId);

    let bankTxDeleted = 0;
    let bankTxUpdated = 0;

    for (const tx of subBankTxs) {
      const key = makeKey(tx);
      if (mainTxKeys.has(key)) {
        // 이미 메인에 있는 동일 거래이므로 중복으로 삭제
        db.prepare('DELETE FROM bank_transactions WHERE id = ?').run(tx.id);
        bankTxDeleted++;
      } else {
        // 메인에 없는 고유 거래이므로 메인 계좌 정보로 업데이트하여 이관
        db.prepare(`
          UPDATE bank_transactions 
          SET account_id = ?, account_number = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(mapping.mainId, mapping.mainNumber, tx.id);
        bankTxUpdated++;
      }
    }
    console.log(`   - 삭제된 중복 거래: ${bankTxDeleted}건`);
    console.log(`   - 이관된 고유 거래: ${bankTxUpdated}건`);

    // B. transactions (통합 거래 내역) 중복 제거 및 이관
    console.log('\n[2/5] transactions 마이그레이션 및 중복 제거 중...');
    
    const mainTransactions = db.prepare(`
      SELECT transaction_datetime, deposit, withdrawal, balance 
      FROM transactions 
      WHERE account_id = ?
    `).all(mapping.mainId);

    const makeTransKey = (tx) => `${tx.transaction_datetime}_${tx.deposit}_${tx.withdrawal}_${tx.balance}`;
    const mainTransKeys = new Set(mainTransactions.map(makeTransKey));

    const subTransactions = db.prepare(`
      SELECT id, transaction_datetime, deposit, withdrawal, balance 
      FROM transactions 
      WHERE account_id = ?
    `).all(mapping.subId);

    let transDeleted = 0;
    let transUpdated = 0;

    for (const tx of subTransactions) {
      const key = makeTransKey(tx);
      if (mainTransKeys.has(key)) {
        db.prepare('DELETE FROM transactions WHERE id = ?').run(tx.id);
        transDeleted++;
      } else {
        db.prepare(`
          UPDATE transactions 
          SET account_id = ?, bank_id = ? 
          WHERE id = ?
        `).run(mapping.mainId, mapping.bank, tx.id);
        transUpdated++;
      }
    }
    console.log(`   - 삭제된 중복 거래: ${transDeleted}건`);
    console.log(`   - 이관된 고유 거래: ${transUpdated}건`);

    // C. 기타 참조 관계 테이블 업데이트 (단순 외래키 교체)
    console.log('\n[3/5] 단순 외래키 참조 테이블 업데이트 중...');

    // sync_operations
    const syncOpRes = db.prepare('UPDATE sync_operations SET account_id = ?, bank_id = ? WHERE account_id = ?').run(mapping.mainId, mapping.bank, mapping.subId);
    console.log(`   - sync_operations 업데이트: ${syncOpRes.changes}건`);

    // card_transactions
    const cardRes = db.prepare('UPDATE card_transactions SET account_id = ? WHERE account_id = ?').run(mapping.mainId, mapping.subId);
    console.log(`   - card_transactions 업데이트: ${cardRes.changes}건`);

    // promissory_notes
    const noteRes = db.prepare('UPDATE promissory_notes SET account_id = ?, bank_id = ? WHERE account_id = ?').run(mapping.mainId, mapping.bank, mapping.subId);
    console.log(`   - promissory_notes 업데이트: ${noteRes.changes}건`);

    // D. 마스터 테이블에서 서브 계좌 영구 제거 (순서를 앞당겨 UNIQUE 제약 충돌 방지)
    console.log('\n[4/5] 서브 계좌 정보 마스터 테이블에서 삭제 중...');
    db.prepare('DELETE FROM accounts WHERE id = ?').run(mapping.subId);
    console.log(`   - 서브 계좌 삭제 완료: ID=${mapping.subId}`);

    // E. 주 계좌의 메타데이터 및 계좌번호 보정 (대시 포맷 강제 설정)
    console.log('\n[5/5] 주 계좌번호 대시 포맷 보정 중...');
    
    // 하나은행 등의 주 계좌 번호 컬럼을 대시형으로 갱신 (서브가 이미 지워졌으므로 UNIQUE 충돌 없음)
    db.prepare('UPDATE accounts SET account_number = ?, updated_at = datetime(\'now\') WHERE id = ?').run(mapping.mainNumber, mapping.mainId);
    
    // 기존에 있던 메인 계좌의 bank_transactions의 account_number 컬럼도 대시가 들어간 표준번호로 함께 갱신
    const mainTxNumRes = db.prepare('UPDATE bank_transactions SET account_number = ? WHERE account_id = ?').run(mapping.mainNumber, mapping.mainId);
    console.log(`   - 주 계좌 마스터 번호 갱신 완료 (${mapping.mainNumber})`);
    console.log(`   - 기존 메인 거래 내역의 계좌번호 컬럼 갱신: ${mainTxNumRes.changes}건`);
  }

  console.log(`\n========================================`);
  console.log('🧪 마이그레이션 정합성 수치 검증 실시...');

  // 검증 1: accounts 테이블 중복 점검
  const remainingAccounts = db.prepare("SELECT * FROM accounts").all();
  const normalizedList = remainingAccounts.map(a => a.account_number.replace(/[^0-9]/g, ''));
  const uniqueNormalized = new Set(normalizedList);
  
  if (remainingAccounts.length !== uniqueNormalized.size) {
    throw new Error(`[검증 실패] 마이그레이션 후에도 정규화 계좌번호 중복이 존재합니다. (남은 계좌수: ${remainingAccounts.length}, 고유 계좌수: ${uniqueNormalized.size})`);
  }
  console.log(`✅ [검증 통과] accounts 테이블 내 정규화 계좌번호 중복이 완벽하게 해소되었습니다. (총 ${remainingAccounts.length}개 계좌 존재)`);

  // 검증 2: 대시 포맷 미적용 계좌 점검
  const targetMainIds = migrationMapping.map(m => m.mainId);
  const targetAccounts = remainingAccounts.filter(a => targetMainIds.includes(a.id));
  
  for (const ta of targetAccounts) {
    if (!ta.account_number.includes('-')) {
      throw new Error(`[검증 실패] 마이그레이션 대상 계좌 ${ta.account_name} (${ta.id}) 번호에 대시가 포함되어 있지 않습니다: ${ta.account_number}`);
    }
  }
  console.log('✅ [검증 통과] 마이그레이션 대상 계좌들이 대시 포맷으로 완벽히 설정되었습니다.');

  // 검증 3: 신규 외래 키 위반 여부 확인 (차분 검증 패턴)
  const currentFkErrors = db.prepare('PRAGMA foreign_key_check').all();
  const newFkErrors = [];

  for (const err of currentFkErrors) {
    const errorKey = `${err.table}_${err.rowid}`;
    if (!preExistingFkErrors.has(errorKey)) {
      newFkErrors.push(err);
    }
  }

  if (newFkErrors.length > 0) {
    throw new Error(`[검증 실패] 이번 마이그레이션으로 인해 새로운 외래 키 위반 데이터가 생겨났습니다: ${JSON.stringify(newFkErrors)}`);
  }
  console.log(`✅ [검증 통과] 마이그레이션으로 인한 새로운 외래 키(FK) 위반이 없으며 모든 관계 정합성이 완벽합니다. (기존 위반 무시: ${preExistingFkErrors.size}건)`);

  console.log('\n🎉 마이그레이션 트랜잭션이 성공적으로 처리되었습니다. 커밋을 진행합니다.');
});

try {
  runMigration();
  console.log('\n🚀 [마이그레이션 완료] 데이터베이스에 변경 사항이 안전하게 반영되었습니다!');
} catch (error) {
  console.error('\n❌ 마이그레이션 중 에러가 발생하여 롤백이 일어났습니다.');
  console.error(error.message);
  
  // 백업 파일로부터 복원 복사 시도
  if (fs.existsSync(backupPath)) {
    console.log('🔄 기존 백업 파일에서 복원을 시작합니다...');
    fs.copyFileSync(backupPath, dbPath);
    console.log('✅ 데이터베이스가 작업 시작 전 상태로 완벽하게 복원되었습니다.');
  }
} finally {
  db.close();
}
