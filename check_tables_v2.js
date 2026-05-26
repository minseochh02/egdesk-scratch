const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

const dbPath = path.join(os.homedir(), 'Library/Application Support/EGDesk/database/financehub.db');
const db = new Database(dbPath);

try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('ibk_endorsements', 'hana_loan_history', 'ibk_loan_history', 'ibk_loan_transactions')").all();
  console.log('Existing tables:', tables.map(t => t.name));
  
  const migrationState = db.prepare("SELECT * FROM _migration_state WHERE name = '035-create-banking-product-tables'").get();
  console.log('Migration 035 state:', migrationState);
} catch (err) {
  console.error('Error:', err.message);
} finally {
  db.close();
}
