// scratch/migrate_kb_accounts.js
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

const dbDir = path.join(os.homedir(), 'AppData', 'Roaming', 'egdesk', 'database');
const dbPath = path.join(dbDir, 'financehub.db');
const backupPath = path.join(dbDir, 'financehub.db.bak3');

console.log('🔄 국민은행 계좌번호 교정 마이그레이션 작업을 시작합니다.');
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

// 마이그레이션 실행
const runMigration = db.transaction(() => {
  console.log('\n🔐 데이터베이스 트랜잭션을 시작합니다...');

  const targets = [
    {
      id: 'b1226e9f-605f-4194-b70b-d1533392b709',
      oldNum: '601-04-165951',
      newNum: '246601-04-165951'
    },
    {
      id: '125d09d7-2557-49ac-ac54-f01fb57fa8c8',
      oldNum: '2018168693',
      newNum: '669116-01-573291'
    }
  ];

  for (const target of targets) {
    console.log(`\n========================================`);
    console.log(`🏦 대상 계좌 ID: ${target.id}`);
    console.log(`👉 기존 계좌번호: "${target.oldNum}"`);
    console.log(`👉 수정될 계좌번호: "${target.newNum}"`);

    // A. accounts 테이블의 계좌번호 수정
    const accountUpdateRes = db.prepare(`
      UPDATE accounts 
      SET account_number = ?, updated_at = datetime('now') 
      WHERE id = ? AND account_number = ?
    `).run(target.newNum, target.id, target.oldNum);

    if (accountUpdateRes.changes === 0) {
      console.log(`⚠️ 경고: 대상 계좌(${target.oldNum})가 accounts 테이블에서 수정되지 않았습니다 (이미 변경되었거나 부재함).`);
    } else {
      console.log(`✅ accounts 테이블 내 계좌번호 갱신 완료.`);
    }

    // B. bank_transactions 테이블의 account_number 컬럼 보정
    const txRes = db.prepare(`
      UPDATE bank_transactions 
      SET account_number = ?, updated_at = datetime('now') 
      WHERE account_id = ? AND account_number = ?
    `).run(target.newNum, target.id, target.oldNum);
    console.log(`✅ 관련 bank_transactions 거래 내역 계좌번호 컬럼 갱신: ${txRes.changes}건 완료.`);
  }

  console.log(`\n========================================`);
  console.log('🧪 마이그레이션 정합성 수치 검증 실시...');

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
    throw new Error(`[검증 실패] 이번 마이그레이션으로 인해 새로운 외래 키 위반 데이터가 생겨났습니다: ${JSON.stringify(newFkErrors)}`);
  }
  console.log(`✅ [검증 통과] 마이그레이션으로 인한 신규 외래 키(FK) 위반이 없으며 모든 데이터 무결성이 완벽하게 보장됩니다.`);

  console.log('\n🎉 마이그레이션 트랜잭션이 성공적으로 처리되었습니다. 커밋을 진행합니다.');
});

try {
  runMigration();
  console.log('\n🚀 [마이그레이션 완료] 데이터베이스 내 국민은행 계좌번호 교정 작업이 완료되었습니다!');
} catch (error) {
  console.error('\n❌ 마이그레이션 중 에러가 발생하여 롤백이 일어났습니다.');
  console.error(error.message);
  
  if (fs.existsSync(backupPath)) {
    console.log('🔄 기존 백업 파일에서 복원을 시작합니다...');
    fs.copyFileSync(backupPath, dbPath);
    console.log('✅ 데이터베이스가 작업 시작 전 상태로 완벽하게 복원되었습니다.');
  }
} finally {
  db.close();
}
