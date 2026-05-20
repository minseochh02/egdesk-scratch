const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'databases', 'rookie.db');
console.log(`Target DB Path: ${dbPath}`);

const db = new Database(dbPath);

try {
  console.log('--- TABLES IN ROOKIE.DB ---');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log(tables);

  for (const t of tables) {
    try {
      const count = db.prepare(`SELECT COUNT(*) as cnt FROM ${t.name}`).get().cnt;
      console.log(`Table ${t.name}: ${count} rows`);
      
      const columns = db.prepare(`PRAGMA table_info(${t.name})`).all();
      const hasAccount = columns.some(c => c.name.includes('account'));
      if (hasAccount) {
        console.log(`-> Has account fields in ${t.name}:`, columns.map(c => c.name));
        const sample = db.prepare(`SELECT * FROM ${t.name} LIMIT 5`).all();
        console.log(`Sample data for ${t.name}:`, sample);
      }
    } catch (e) {
      console.log(`Error reading table ${t.name}:`, e.message);
    }
  }

} catch (e) {
  console.error("Error reading rookie.db:", e.message);
}



