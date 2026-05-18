import { FinanceHubDbManager } from '../src/main/sqlite/financehub';
import Database = require('better-sqlite3');
import * as path from 'path';
import * as fs from 'fs';

const dbPath = path.join(
  process.env.APPDATA || '',
  'egdesk',
  'database',
  'financehub.db'
);

console.log('🧪 중복 방지/업그레이드 로직 테스트 시작...');

if (!fs.existsSync(dbPath)) {
  console.error('❌ 데이터베이스 파일이 존재하지 않습니다.');
  process.exit(1);
}

// better-sqlite3 DB 연결
const sqliteDb = new Database(dbPath);

// 테스트용 FinanceHubDbManager 인스턴스 생성 (DB 객체 주입)
const dbInstance = new FinanceHubDbManager(sqliteDb);

const testAccountId = 'b1226e9f-605f-4194-b70b-d1533392b709'; // 국민은행 계좌
const testBankId = 'kookmin';

const testTx1 = {
  date: '2026-05-18',
  time: '12:34:00', // 초가 생략된 엑셀 데이터 가정
  withdrawal: 0,
  deposit: 500000,
  balance: 2000000,
  description: '테스트입금(Excel)',
};

const testTx2 = {
  date: '2026-05-18',
  time: '12:34:45', // 초가 살아있는 크롤링 데이터 가정 (시간은 12:34로 매칭)
  withdrawal: 0,
  deposit: 500000,
  balance: 2000000,
  description: '테스트입금(Scraped 상세)',
  description2: '{"상세":"크롤링 상세정보 메타데이터"}',
};

try {
  // 0. 테스트 전에 기존 테스트 데이터 클린업 (sqliteDb 직접 조작으로 private 우회)
  sqliteDb.prepare('DELETE FROM bank_transactions WHERE account_id = ? AND transaction_date = ?').run(testAccountId, '2026-05-18');
  console.log('🧹 기존 테스트 거래를 초기화했습니다.');

  // 1. 첫 번째 삽입 (초 생략된 Excel 데이터 삽입)
  console.log('\n📥 [1단계] Excel 거래 데이터(초: 00) 삽입 시도...');
  const res1 = dbInstance.bulkInsertBankTransactions(testAccountId, testBankId, [testTx1]);
  console.log(`   결과 - 삽입: ${res1.inserted}건, 스킵: ${res1.skipped}건`);

  // DB 확인
  let row = sqliteDb.prepare('SELECT id, transaction_time, description FROM bank_transactions WHERE account_id = ? AND transaction_date = ?').get(testAccountId, '2026-05-18') as any;
  console.log(`   DB 현재 상태: 시간 = ${row.transaction_time}, 적요 = ${row.description}`);

  // 2. 두 번째 삽입 (초가 상세하게 살아있는 Scraped 데이터 삽입 -> 업그레이드 되어야 함)
  console.log('\n📥 [2단계] 크롤링 거래 데이터(초: 45) 삽입 시도 (업그레이드 및 덮어쓰기 유도)...');
  const res2 = dbInstance.bulkInsertBankTransactions(testAccountId, testBankId, [testTx2]);
  console.log(`   결과 - 삽입/업데이트: ${res2.inserted}건, 스킵: ${res2.skipped}건`);

  // DB 확인
  row = sqliteDb.prepare('SELECT id, transaction_time, description, description2 FROM bank_transactions WHERE account_id = ? AND transaction_date = ?').get(testAccountId, '2026-05-18') as any;
  console.log(`   DB 현재 상태: 시간 = ${row.transaction_time}, 적요 = ${row.description}, 상세 = ${row.description2}`);

  if (row.transaction_time === '12:34:45' && row.description === '테스트입금(Scraped 상세)') {
    console.log('   🎉 [성공] 엑셀 데이터가 상세 크롤링 데이터로 성공적으로 자동 병합(업그레이드)되었습니다!');
  } else {
    console.error('   ❌ [실패] 데이터가 성공적으로 업그레이드되지 않았습니다.');
  }

  // 3. 세 번째 삽입 (동일한 크롤링 데이터 재삽입 -> 완전히 무시(스킵)되어야 함)
  console.log('\n📥 [3단계] 동일한 크롤링 거래 데이터 재삽입 시도 (중복 스킵 유도)...');
  const res3 = dbInstance.bulkInsertBankTransactions(testAccountId, testBankId, [testTx2]);
  console.log(`   결과 - 삽입/업데이트: ${res3.inserted}건, 스킵: ${res3.skipped}건`);

  if (res3.skipped === 1 && res3.inserted === 0) {
    console.log('   🎉 [성공] 중복 거래 데이터가 완벽하게 감지되어 스킵 처리되었습니다!');
  } else {
    console.error('   ❌ [실패] 중복 거래 데이터가 스킵되지 않았습니다.');
  }

  // 4. 청소
  sqliteDb.prepare('DELETE FROM bank_transactions WHERE account_id = ? AND transaction_date = ?').run(testAccountId, '2026-05-18');
  console.log('\n🧹 테스트 데이터 청소를 완료했습니다.');

} catch (e) {
  console.error('❌ 테스트 에러:', e);
} finally {
  sqliteDb.close();
}
