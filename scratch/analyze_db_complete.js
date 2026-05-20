const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

const localDbPath = path.join(__dirname, '..', 'financehub.db');
const appDataDbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'egdesk', 'database', 'financehub.db');

function analyzeDb(dbPath, label) {
  console.log(`\n========================================`);
  console.log(`🔍 분석 대상 [${label}]: ${dbPath}`);
  
  if (!fs.existsSync(dbPath)) {
    console.log(`❌ 파일이 존재하지 않습니다.`);
    return;
  }

  let db;
  try {
    db = new Database(dbPath, { readonly: true });
  } catch (e) {
    console.log(`❌ DB 연결 실패: ${e.message}`);
    return;
  }

  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log(`📂 테이블 목록:`, tables.map(t => t.name).join(', '));

    if (!tables.some(t => t.name === 'accounts')) {
      console.log(`❌ 'accounts' 테이블이 존재하지 않습니다.`);
      db.close();
      return;
    }

    const accounts = db.prepare("SELECT * FROM accounts").all();
    console.log(`📊 accounts 테이블 총 레코드 수: ${accounts.length}개`);

    // 중복 체크용 (숫자만 남겼을 때 동일한 쌍)
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

    console.log(`🔎 숫자 정규화 기준 중복 계좌 수: ${duplicates.length}쌍`);
    if (duplicates.length > 0) {
      for (const dup of duplicates) {
        console.log(`\n  - 중복 키: ${dup.key}`);
        dup.list.forEach(a => {
          console.log(`    * ID: ${a.id} | 은행: ${a.bank_id} | 계좌번호: "${a.account_number}" | 이름: ${a.account_name}`);
        });
      }
    } else {
      console.log(`  - 100% 숫자 정규화 중복은 존재하지 않습니다.`);
    }

    // 좀 더 느슨한 기준의 중복 점검 (예: 대시가 한쪽에만 있고, 앞부분/뒷부분 매칭 등)
    console.log(`\n🔎 대시 유무 및 느슨한 정합성 기준 추가 점검...`);
    const looseDuplicates = [];
    for (let i = 0; i < accounts.length; i++) {
      for (let j = i + 1; j < accounts.length; j++) {
        const a1 = accounts[i];
        const a2 = accounts[j];
        if (a1.bank_id === a2.bank_id) {
          const n1 = a1.account_number.replace(/[^0-9]/g, '');
          const n2 = a2.account_number.replace(/[^0-9]/g, '');
          
          // 숫자가 완전히 같지는 않지만 대시를 빼거나 더했을 때 매칭되거나, 
          // 혹은 한쪽이 다른 쪽의 부분 문자열이거나 (예: 앞의 0이 빠진 경우 등)
          const isLooseDup = (n1 === n2) || 
                            (n1.padStart(n2.length, '0') === n2) || 
                            (n2.padStart(n1.length, '0') === n1) ||
                            (n1.endsWith(n2) && n2.length >= 6) || 
                            (n2.endsWith(n1) && n1.length >= 6);

          if (isLooseDup && n1 !== n2) {
            looseDuplicates.push({ a1, a2 });
          }
        }
      }
    }

    console.log(`🔎 느슨한 기준 중복 계좌 수: ${looseDuplicates.length}쌍`);
    for (const pair of looseDuplicates) {
      console.log(`\n  - 느슨한 매칭 발견:`);
      console.log(`    * 계좌 A: ID=${pair.a1.id} | 번호="${pair.a1.account_number}" | 이름=${pair.a1.account_name}`);
      console.log(`    * 계좌 B: ID=${pair.a2.id} | 번호="${pair.a2.account_number}" | 이름=${pair.a2.account_name}`);
    }

  } catch (err) {
    console.log(`❌ 분석 중 에러 발생:`, err.message);
  } finally {
    db.close();
  }
}

analyzeDb(localDbPath, '로컬 작업 공간 DB');
analyzeDb(appDataDbPath, 'AppData Roaming DB');
