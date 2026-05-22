const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join('C:', 'Users', 'user', 'AppData', 'Roaming', 'egdesk', 'database', 'financehub.db');
console.log('Target DB Path:', dbPath);

const db = new Database(dbPath);

try {
  db.transaction(() => {
    // 1. Target Account Info (자본금증자통장)
    const targetAccount = db.prepare('SELECT id, account_number, account_name FROM accounts WHERE account_number = ?').get('306-063568-04-075');
    
    if (!targetAccount) {
      throw new Error('Target account 306-063568-04-075 not found in DB!');
    }
    console.log('Target Account Found:', targetAccount);

    // 2. Temp Manual Account Info
    const tempAccount = db.prepare('SELECT id, account_number, account_name FROM accounts WHERE id = ?').get('1218a222-5b88-467f-b9bc-5c7b4a585129');
    console.log('Temp Manual Account Found:', tempAccount);

    // 3. Update transactions
    const updateResult = db.prepare(`
      UPDATE bank_transactions 
      SET account_id = ?, account_number = ?, account_name = ?
      WHERE account_id = ?
    `).run(targetAccount.id, targetAccount.account_number, targetAccount.account_name, '1218a222-5b88-467f-b9bc-5c7b4a585129');

    console.log(`Successfully migrated ${updateResult.changes} transactions to 306-063568-04-075!`);
    
    // 4. Optionally, remove the empty MANUALIMPORT account if needed
    // const deleteAccount = db.prepare('DELETE FROM accounts WHERE id = ?').run('1218a222-5b88-467f-b9bc-5c7b4a585129');
    // console.log('Cleaned up temp MANUALIMPORT account.');
  })();
} catch (err) {
  console.error('Migration failed:', err.message);
} finally {
  db.close();
}
