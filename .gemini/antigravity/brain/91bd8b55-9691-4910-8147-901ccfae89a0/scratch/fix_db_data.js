const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.env.APPDATA, 'egdesk', 'database', 'financehub.db');
const db = new Database(dbPath);

console.log('--- Database Cleanup Started ---');

// 1. Delete rows with empty or null dates (ghost rows)
const deleteResult = db.prepare(`
  DELETE FROM bank_transactions 
  WHERE transaction_date IS NULL 
     OR transaction_date = '' 
     OR transaction_datetime IS NULL 
     OR transaction_datetime = ''
`).run();
console.log(`✅ Deleted ${deleteResult.changes} ghost rows (empty dates).`);

// 2. Find rows with YYYYMMDD format (8 digits)
const rowsToFix = db.prepare(`
  SELECT id, transaction_date, transaction_time, transaction_datetime 
  FROM bank_transactions 
  WHERE transaction_date LIKE '________' -- Exactly 8 characters
    AND transaction_date NOT LIKE '%-%'
`).all();

console.log(`🔍 Found ${rowsToFix.length} rows with incorrect date format (YYYYMMDD).`);

let fixedCount = 0;
const updateStmt = db.prepare(`
  UPDATE bank_transactions 
  SET transaction_date = ?, 
      transaction_datetime = ? 
  WHERE id = ?
`);

const transaction = db.transaction((rows) => {
    for (const row of rows) {
        const d = row.transaction_date;
        const newDate = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
        
        // Ensure datetime is also formatted correctly: YYYY/MM/DD HH:MM:SS
        const timePart = row.transaction_time || '00:00:00';
        const newDatetime = `${newDate.replace(/-/g, '/')} ${timePart}`;
        
        updateStmt.run(newDate, newDatetime, row.id);
        fixedCount++;
    }
});

transaction(rowsToFix);
console.log(`✅ Successfully fixed ${fixedCount} rows with correct date formatting.`);

db.close();
console.log('--- Database Cleanup Finished ---');
