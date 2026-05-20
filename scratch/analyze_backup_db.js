const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

const backupDbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'egdesk', 'database', 'financehub.db.bak');
console.log(`Connecting to Backup DB: ${backupDbPath}`);

if (!fs.existsSync(backupDbPath)) {
  console.error("Backup DB File does not exist!");
  process.exit(1);
}

const db = new Database(backupDbPath, { readonly: true });

try {
  const accounts = db.prepare("SELECT * FROM accounts").all();
  console.log(`📊 Backup accounts 테이블 총 레코드 수: ${accounts.length}개`);

  // 숫자만 남겼을 때 동일한 쌍 찾기
  const normalizedMap = new Map();
  const duplicates = [];

  for (const acc of accounts) {
    const numOnly = acc.account_number.replace(/[^0-9]/g, '');
    const key = `${acc.bank_id}_${numOnly}`;
    if (normalizedMap.has(key)) {
      normalizedMap.get(key).push(acc);
    } else {
      normalizedMap.set(key, [acc]);
    }
  }

  for (const [key, list] of normalizedMap.entries()) {
    if (list.length > 1) {
      duplicates.push({ key, list });
    }
  }

  console.log(`🔎 백업 DB 내 숫자 정규화 기준 중복 계좌 수: ${duplicates.length}쌍`);
  if (duplicates.length > 0) {
    for (const dup of duplicates) {
      console.log(`\n  - 중복 키: ${dup.key}`);
      dup.list.forEach(a => {
        console.log(`    * ID: ${a.id} | 은행: ${a.bank_id} | 계좌번호: "${a.account_number}" | 이름: ${a.account_name}`);
      });
    }
  }

} catch (e) {
  console.error("에러 발생:", e);
} finally {
  db.close();
}
