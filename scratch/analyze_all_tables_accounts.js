const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'egdesk', 'database', 'financehub.db');
console.log(`Connecting to DB: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
  console.error("DB File does not exist!");
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log(`\n=== ALL TABLES IN DB (${tables.length}) ===`);

  for (const t of tables) {
    const tableName = t.name;
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    
    // account_number, account, no 등 계좌와 관련 있어 보이는 컬럼 찾기
    const accountCols = columns.filter(c => 
      c.name.toLowerCase().includes('account') || 
      c.name.toLowerCase().includes('acc') ||
      c.name.toLowerCase().includes('계좌')
    );

    if (accountCols.length > 0) {
      console.log(`\n--------------------------------------------------`);
      console.log(`📁 테이블: ${tableName} (총 행수: ${db.prepare(`SELECT COUNT(*) as cnt FROM ${tableName}`).get().cnt})`);
      console.log(`📌 계좌 관련 컬럼:`, accountCols.map(c => c.name));

      // 각 컬럼별 고유 값들 추출해보기
      for (const col of accountCols) {
        const colName = col.name;
        const distinctValues = db.prepare(`
          SELECT DISTINCT ${colName} as val, COUNT(*) as cnt 
          FROM ${tableName} 
          WHERE ${colName} IS NOT NULL AND ${colName} != ''
          GROUP BY ${colName}
        `).all();

        console.log(`  - 컬럼 [${colName}] 고유값 개수: ${distinctValues.length}`);
        
        // 고유값들 중 대시 있는 버전과 없는 버전의 중복 패턴 검사
        const hasDash = distinctValues.filter(v => typeof v.val === 'string' && v.val.includes('-'));
        const noDash = distinctValues.filter(v => typeof v.val === 'string' && !v.val.includes('-'));

        const matchedDups = [];
        for (const hd of hasDash) {
          const hdNorm = hd.val.replace(/[^0-9]/g, '');
          for (const nd of noDash) {
            const ndNorm = nd.val.replace(/[^0-9]/g, '');
            if (hdNorm === ndNorm && hdNorm.length > 0) {
              matchedDups.push({ dash: hd.val, noDash: nd.val, countDash: hd.cnt, countNoDash: nd.cnt });
            }
          }
        }

        if (matchedDups.length > 0) {
          console.log(`    ⚠️  [중복 매칭 발견] 대시 유무로만 구분되는 중복 데이터 존재!`);
          matchedDups.forEach(m => {
            console.log(`      * 대시버전: "${m.dash}" (행수: ${m.countDash}) <--> 무대시버전: "${m.noDash}" (행수: ${m.countNoDash})`);
          });
        }
      }
    }
  }

} catch (e) {
  console.error("에러 발생:", e);
} finally {
  db.close();
}
