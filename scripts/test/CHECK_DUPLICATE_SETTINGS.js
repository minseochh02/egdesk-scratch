const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const userDataPath = path.join(os.homedir(), 'EGDesk-Data');
const dbPath = path.join(userDataPath, 'user_data.db');

console.log('Opening database:', dbPath);
const db = new Database(dbPath, { readonly: true });

// Check all tables and their duplicate detection settings
const tables = db.prepare('SELECT * FROM user_tables').all();

console.log('\n=== USER TABLES AND DUPLICATE DETECTION SETTINGS ===\n');

tables.forEach(table => {
  console.log(`Table: ${table.display_name} (${table.table_name})`);
  console.log(`  ID: ${table.id}`);
  console.log(`  Row Count: ${table.row_count}`);
  console.log(`  Unique Key Columns: ${table.unique_key_columns || 'NOT SET ❌'}`);
  console.log(`  Duplicate Action: ${table.duplicate_action || 'NOT SET ❌'}`);
  console.log(`  Created: ${table.created_at}`);
  console.log('');
});

// Check sync configurations
const configs = db.prepare('SELECT * FROM sync_configurations').all();

console.log('\n=== SYNC CONFIGURATIONS ===\n');

configs.forEach(config => {
  console.log(`Config: ${config.script_name}`);
  console.log(`  Target Table: ${config.target_table_id}`);
  console.log(`  Unique Key Columns: ${config.unique_key_columns || 'NOT SET ❌'}`);
  console.log(`  Duplicate Action: ${config.duplicate_action || 'NOT SET ❌'}`);
  console.log(`  Auto Sync: ${config.auto_sync_enabled ? 'YES' : 'NO'}`);
  console.log('');
});

db.close();
