const Database = require('better-sqlite3');
const dbPath = 'C:\\Users\\user\\AppData\\Roaming\\egdesk\\database\\financehub.db';

try {
  const db = new Database(dbPath, { fileMustExist: true });
  console.log('=== ALL ACCOUNTS IN DB ===');
  const accounts = db.prepare('SELECT * FROM accounts').all();
  accounts.forEach(acc => {
    console.log(JSON.stringify(acc, null, 2));
  });
  db.close();
} catch (err) {
  console.error('Failed to read DB:', err);
}
