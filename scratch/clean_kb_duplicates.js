// scratch/clean_kb_duplicates.js
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

const dbDir = path.join(os.homedir(), 'AppData', 'Roaming', 'egdesk', 'database');
const dbPath = path.join(dbDir, 'financehub.db');
const backupPath = path.join(dbDir, 'financehub.db.bak4');

console.log('🔄 국민은행 중복 거래 클리닝 및 임시 계좌 삭제 작업을 시작합니다.');
console.log(`- 대상 DB: ${dbPath}`);
console.log(`- 백업 DB: ${backupPath}`);

// 1. DB 백업 생성
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

// 사전 외래 키 위반 목록 체크
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

// 클리닝 마이그레이션 실행
const runCleaning = db.transaction(() => {
  console.log('\n🔐 데이터베이스 클리닝 트랜잭션을 시작합니다...');

  const fakeAccountId = '35ff1d94-f09e-416a-9424-2434ee7094a0'; // 1000000000000 (100-000-0000000)
  const realAccountId = '125d09d7-2557-49ac-ac54-f01fb57fa8c8'; // 669116-01-573291
  const bizAccountId = 'b1226e9f-605f-4194-b70b-d1533392b709';  // 246601-04-165951

  // ==========================================
  // 작업 A. 가짜 임시 계좌 (1000000000000) 관련 데이터 전면 완전 삭제
  // ==========================================
  console.log('\n[작업 A] 가짜 임시 계좌 (1000000000000) 관련 데이터 삭제 중...');
  
  // 1. bank_transactions 삭제
  const delFakeTxs = db.prepare('DELETE FROM bank_transactions WHERE account_id = ?').run(fakeAccountId);
  console.log(`   - bank_transactions 테이블 내 찌꺼기 거래 삭제 완료: ${delFakeTxs.changes}건`);

  // 2. sync_operations 삭제
  const delFakeSync = db.prepare('DELETE FROM sync_operations WHERE account_id = ?').run(fakeAccountId);
  console.log(`   - sync_operations 테이블 내 작업 기록 삭제 완료: ${delFakeSync.changes}건`);

  // 3. accounts 삭제
  const delFakeAcc = db.prepare('DELETE FROM accounts WHERE id = ?').run(fakeAccountId);
  console.log(`   - accounts 마스터 테이블 내 가짜 계좌 레코드 삭제 완료: ${delFakeAcc.changes}건`);


  // ==========================================
  // 작업 B. 국민은행 실계좌 (669116-01-573291)의 복제된 찌꺼기 거래 청소 (계좌 유지)
  // ==========================================
  console.log('\n[작업 B] 국민은행 실계좌 (669116-01-573291)의 복제 찌꺼기 거래 청소 중...');
  
  const delRealTxs = db.prepare('DELETE FROM bank_transactions WHERE account_id = ?').run(realAccountId);
  console.log(`   - bank_transactions 테이블 내 찌꺼기 거래 삭제 완료 (계좌 마스터 유지): ${delRealTxs.changes}건`);


  // ==========================================
  // 작업 C. KB기업종합통장 (246601-04-165951)의 자체 이중 중복 잉여 거래 (상대방 null) 삭제
  // ==========================================
  console.log('\n[작업 C] KB기업종합통장 (246601-04-165951) 내부 이중 중복 잉여 거래 정규화 중...');
  
  // 상대방이 null이면서 동일 시간대(2026/02/26 ~ 02/27)에 겹치는 중복 레코드 3건 삭제
  const delBizDupTxs = db.prepare(`
    DELETE FROM bank_transactions 
    WHERE account_id = ? 
      AND counterparty_name IS NULL 
      AND transaction_datetime IN ('2026/02/26 15:57:48', '2026/02/26 16:04:18', '2026/02/27 10:06:12')
  `).run(bizAccountId);
  console.log(`   - bank_transactions 테이블 내 잉여 중복 거래(상대방 null) 삭제 완료: ${delBizDupTxs.changes}건`);


  console.log(`\n========================================`);
  console.log('🧪 클리닝 정합성 무결성 검증 실시...');

  // 검증 1: 신규 외래 키 위반 여부 확인 (차분 검증 패턴)
  const currentFkErrors = db.prepare('PRAGMA foreign_key_check').all();
  const newFkErrors = [];

  for (const err of currentFkErrors) {
    const errorKey = `${err.table}_${err.rowid}`;
    if (!preExistingFkErrors.has(errorKey)) {
      newFkErrors.push(err);
    }
  }

  if (newFkErrors.length > 0) {
    throw new Error(`[검증 실패] 이번 클리닝으로 인해 새로운 외래 키 위반 데이터가 생겨났습니다: ${JSON.stringify(newFkErrors)}`);
  }
  console.log(`✅ [검증 통과] 클리닝으로 인한 신규 외래 키(FK) 위반이 없으며 모든 정합성이 완벽히 보장됩니다.`);

  console.log('\n🎉 클리닝 트랜잭션이 성공적으로 처리되었습니다. 커밋을 진행합니다.');
});

try {
  runCleaning();
  console.log('\n🚀 [클리닝 완료] 가짜 계좌 완전 삭제 및 복제 중복 거래들의 영구 제거 작업이 완료되었습니다!');
} catch (error) {
  console.error('\n❌ 클리닝 중 에러가 발생하여 롤백이 일어났습니다.');
  console.error(error.message);
  
  if (fs.existsSync(backupPath)) {
    console.log('🔄 기존 백업 파일에서 복원을 시작합니다...');
    fs.copyFileSync(backupPath, dbPath);
    console.log('✅ 데이터베이스가 작업 시작 전 상태로 완벽하게 복원되었습니다.');
  }
} finally {
  db.close();
}
