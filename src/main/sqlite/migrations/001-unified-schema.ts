import Database from 'better-sqlite3';
import { initializeFinanceHubSchema } from '../financehub';

export function migrateToUnifiedSchema(db: Database.Database) {
  console.log('🔄 Starting migration to FinanceHub unified schema...');

  // 1. Create new schema
  initializeFinanceHubSchema(db);
  
  // 2. Migrate accounts
  console.log('📦 Migrating accounts...');
  // Use ON CONFLICT DO NOTHING to avoid errors if run multiple times
  db.exec(`
    INSERT INTO accounts (
      id, bank_id, account_number, account_name, customer_name,
      balance, available_balance, open_date, last_synced_at,
      created_at, updated_at, metadata
    )
    SELECT 
      id, 'shinhan', account_number, account_name, customer_name,
      balance, available_balance, open_date, last_synced_at,
      created_at, updated_at, metadata
    FROM shinhan_accounts
    WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='shinhan_accounts')
    ON CONFLICT(bank_id, account_number) DO NOTHING
  `);
  
  // 3. Migrate transactions
  console.log('💸 Migrating transactions...');
  db.exec(`
    INSERT INTO transactions (
      id, account_id, bank_id, date, time, type,
      withdrawal, deposit, description, balance, branch,
      created_at, metadata
    )
    SELECT 
      id, account_id, 'shinhan', date, time, type,
      withdrawal, deposit, description, balance, branch,
      created_at, metadata
    FROM shinhan_transactions
    WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='shinhan_transactions')
    ON CONFLICT(id) DO NOTHING
  `);
  
  // 4. Migrate sync operations
  console.log('🔄 Migrating sync operations...');
  db.exec(`
    INSERT INTO sync_operations (
      id, account_id, bank_id, status, started_at, completed_at,
      duration, query_period_start, query_period_end,
      total_count, total_deposits, deposit_count,
      total_withdrawals, withdrawal_count, file_path,
      error_message, created_at
    )
    SELECT 
      id, account_id, 'shinhan', status, started_at, completed_at,
      duration, query_period_start, query_period_end,
      total_count, total_deposits, deposit_count,
      total_withdrawals, withdrawal_count, excel_file_path,
      error_message, created_at
    FROM shinhan_sync_operations
    WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='shinhan_sync_operations')
    ON CONFLICT(id) DO NOTHING
  `);
  
  console.log('✅ Migration completed successfully');
}

