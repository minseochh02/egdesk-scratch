const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

// 1. 데이터베이스 경로 설정
const dbDir = path.join(os.homedir(), 'AppData', 'Roaming', 'egdesk', 'database');
const dbPath = path.join(dbDir, 'financehub.db');
const backupPath = path.join(dbDir, 'financehub.db.bak2');

console.log('🔄 2차 계좌 표준 대시 포맷 마이그레이션 작업을 시작합니다.');
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

// 마이그레이션 전 기존에 존재하던 외래 키 위반 목록 수집 (차분 검증 패턴)
let preExistingFkErrors = new Set();
try {
  const initialFkErrors = db.prepare('PRAGMA foreign_key_check').all();
  for (const err of initialFkErrors) {
    preExistingFkErrors.add(`${err.table}_${err.rowid}`);
  }
  console.log(`ℹ️ [사전 체크] 기존 DB에 존재하는 외래 키 위반: ${initialFkErrors.length}건 (무시 대상)`);
} catch (e) {
  console.warn('⚠️ 사전 외래 키 체크 실패 (무시하고 진행):', e.message);
}

// 3. 은행 공식 대시 포맷 규격 정의
// 하나 (14자리): 3-6-5
// 기업 (14자리): 3-6-2-3
// 우리 (13자리): 4-3-6
// 우리 (12자리): 3-6-3
function getStandardDashedNumber(bankId, number) {
  const digits = number.replace(/[^0-9]/g, '');
  
  if (bankId === 'hana' && digits.length === 14) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 9)}-${digits.slice(9)}`;
  }
  if (bankId === 'ibk' && digits.length === 14) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 9)}-${digits.slice(9, 11)}-${digits.slice(11)}`;
  }
  if (bankId === 'woori' && digits.length === 13) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (bankId === 'woori' && digits.length === 12) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 9)}-${digits.slice(9)}`;
  }
  return null; // 변환 대상이 아니거나 이미 완벽한 대시
}

// 트랜잭션 하에서 표준화 작업 실행
const runMigration = db.transaction(() => {
  console.log('\n🔐 데이터베이스 트랜잭션을 시작합니다...');

  const accounts = db.prepare("SELECT * FROM accounts").all();
  let accountsUpdated = 0;
  let txsUpdated = 0;

  for (const acc of accounts) {
    // 이미 대시가 포함되어 있다면 공식 세그먼트로 들어온 것이므로 생략 (단, 100% 숫자인 경우만 대상)
    if (acc.account_number.includes('-')) {
      continue;
    }

    const dashedNum = getStandardDashedNumber(acc.bank_id, acc.account_number);
    if (!dashedNum) {
      continue; // 포맷에 해당하지 않는 기타 계좌나 카드는 스킵
    }

    console.log(`\n========================================`);
    console.log(`🏦 은행: ${acc.bank_id.toUpperCase()} | ID: ${acc.id}`);
    console.log(`👉 기존 계좌번호: "${acc.account_number}"`);
    console.log(`👉 표준 대시번호: "${dashedNum}"`);

    // A. accounts 마스터 테이블의 계좌번호 갱신
    db.prepare('UPDATE accounts SET account_number = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(dashedNum, acc.id);
    accountsUpdated++;

    // B. bank_transactions 테이블의 account_number 컬럼 일괄 보정
    const txRes = db.prepare('UPDATE bank_transactions SET account_number = ?, updated_at = datetime(\'now\') WHERE account_id = ?')
      .run(dashedNum, acc.id);
    txsUpdated += txRes.changes;

    console.log(`   - accounts 마스터 번호 표준 대시 전환 완료`);
    console.log(`   - 관련 bank_transactions 거래 내역 계좌번호 컬럼 갱신: ${txRes.changes}건`);
  }

  console.log(`\n========================================`);
  console.log('🧪 마이그레이션 정합성 수치 검증 실시...');

  // 검증 1: 대시 포맷 미적용 계좌 점검
  const remainingAccounts = db.prepare("SELECT * FROM accounts").all();
  for (const ra of remainingAccounts) {
    const isTargetBank = ['hana', 'ibk', 'woori'].includes(ra.bank_id);
    const digitsOnly = ra.account_number.replace(/[^0-9]/g, '');
    const isTargetLength = (ra.bank_id === 'hana' && digitsOnly.length === 14) ||
                           (ra.bank_id === 'ibk' && digitsOnly.length === 14) ||
                           (ra.bank_id === 'woori' && [12, 13].includes(digitsOnly.length));
    
    if (isTargetBank && isTargetLength && !ra.account_number.includes('-')) {
      throw new Error(`[검증 실패] 표준화 대상 계좌 ${ra.account_name} (${ra.id}) 번호에 여전히 대시가 없습니다: ${ra.account_number}`);
    }
  }
  console.log(`✅ [검증 통과] 모든 하나, 기업, 우리은행 대상 계좌에 표준 대시 포맷이 정상 반영되었습니다. (총 ${accountsUpdated}개 계좌 갱신)`);

  // 검증 2: 신규 외래 키 위반 여부 확인 (차분 검증 패턴)
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
  console.log(`✅ [검증 통과] 마이그레이션으로 인한 신규 외래 키(FK) 위반이 없으며 데이터 무결성이 보장됩니다. (기존 위반 무시: ${preExistingFkErrors.size}건)`);

  console.log('\n🎉 마이그레이션 트랜잭션이 성공적으로 처리되었습니다. 커밋을 진행합니다.');
});

try {
  runMigration();
  console.log('\n🚀 [마이그레이션 완료] 데이터베이스 표준 대시 포맷 일괄 전환이 완료되었습니다!');
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
