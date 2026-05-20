const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'egdesk', 'database', 'financehub.db.bak');
const db = new Database(dbPath, { readonly: true });

try {
  const accounts = db.prepare("SELECT * FROM accounts").all();
  console.log(`📊 Backup accounts 테이블 레코드 수: ${accounts.length}개`);

  const looseMap = new Map();
  const duplicates = [];

  for (const acc of accounts) {
    let numOnly = acc.account_number.replace(/[^0-9]/g, '');
    const cleanNum = numOnly.replace(/^0+/, '');
    
    if (cleanNum.length === 0) continue;

    const key = cleanNum; // 은행 구분 없음
    if (looseMap.has(key)) {
      looseMap.get(key).push(acc);
    } else {
      looseMap.set(key, [acc]);
    }
  }

  for (const [key, list] of looseMap.entries()) {
    if (list.length > 1) {
      duplicates.push({ key, list });
    }
  }

  console.log(`🔎 [백업 DB - 은행 무관 + 앞자리 0 제거] 중복 계좌 수: ${duplicates.length}쌍`);
  for (const dup of duplicates) {
    console.log(`\n  - 중복 키(숫자정제): ${dup.key}`);
    dup.list.forEach(a => {
      console.log(`    * ID: ${a.id} | 은행: ${a.bank_id} | 계좌번호: "${a.account_number}" | 이름: ${a.account_name}`);
    });
  }

} catch (e) {
  console.error(e);
} finally {
  db.close();
}
