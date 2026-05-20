const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// 백업 DB 경로
const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'egdesk', 'database', 'financehub.db.bak2');
const db = new Database(dbPath, { readonly: true });

try {
  console.log('=== accounts 테이블 전체 목록 ===');
  const accounts = db.prepare("SELECT id, bank_id, account_number, account_name FROM accounts").all();
  console.table(accounts);

  console.log('\n=== 대시가 없는 계좌 목록 필터링 ===');
  const noDashAccounts = accounts.filter(acc => !acc.account_number.includes('-'));
  console.table(noDashAccounts);

} catch (e) {
  console.error('오류 발생:', e.message);
} finally {
  db.close();
}
