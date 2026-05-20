const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'egdesk', 'database', 'financehub.db');
const db = new Database(dbPath, { readonly: true });

try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log(`Searching all tables in DB: ${dbPath}`);

  for (const t of tables) {
    const tableName = t.name;
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    
    for (const col of columns) {
      const colName = col.name;
      // 문자열 타입일 가능성이 있는 컬럼들만
      try {
        const rows = db.prepare(`
          SELECT DISTINCT ${colName} as val 
          FROM ${tableName} 
          WHERE typeof(${colName}) = 'text' AND (
            ${colName} LIKE '%213-890%' OR 
            ${colName} LIKE '%06003204%' OR
            ${colName} LIKE '%213890%'
          )
        `).all();

        if (rows.length > 0) {
          console.log(`\n📌 Found in [${tableName}].[${colName}]:`);
          rows.forEach(r => {
            console.log(`   - "${r.val}"`);
          });
        }
      } catch (err) {
        // 컬럼 조회가 불가능하거나 에러가 나면 패스
      }
    }
  }

} catch (e) {
  console.error("Error during full search:", e);
} finally {
  db.close();
}
