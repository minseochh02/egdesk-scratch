import Database from 'better-sqlite3';

/**
 * Migration: Add spreadsheet URL columns to Hometax tables
 * This migration adds sales_spreadsheet_url and purchase_spreadsheet_url columns
 * to hometax_connections and hometax_sync_operations tables
 */
export function addHometaxSpreadsheetUrlColumns(db: Database.Database) {
  console.log('🔄 Adding spreadsheet URL columns to Hometax tables...');

  try {
    // Check if hometax_connections table exists
    const tableExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='hometax_connections'")
      .get();

    if (!tableExists) {
      console.log('⏭️  Hometax tables not found, skipping migration');
      return;
    }

    // Check if sales_spreadsheet_url column already exists in hometax_connections
    const connectionColumns = db.prepare("PRAGMA table_info(hometax_connections)").all() as Array<{ name: string }>;
    const hasSalesUrl = connectionColumns.some(col => col.name === 'sales_spreadsheet_url');
    const hasPurchaseUrl = connectionColumns.some(col => col.name === 'purchase_spreadsheet_url');

    if (!hasSalesUrl) {
      console.log('📊 Adding sales_spreadsheet_url to hometax_connections...');
      db.exec('ALTER TABLE hometax_connections ADD COLUMN sales_spreadsheet_url TEXT');
    }

    if (!hasPurchaseUrl) {
      console.log('📊 Adding purchase_spreadsheet_url to hometax_connections...');
      db.exec('ALTER TABLE hometax_connections ADD COLUMN purchase_spreadsheet_url TEXT');
    }

    // Check and add columns to hometax_sync_operations
    const syncTableExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='hometax_sync_operations'")
      .get();

    if (syncTableExists) {
      const syncColumns = db.prepare("PRAGMA table_info(hometax_sync_operations)").all() as Array<{ name: string }>;
      const hasSalesSyncUrl = syncColumns.some(col => col.name === 'sales_spreadsheet_url');
      const hasPurchaseSyncUrl = syncColumns.some(col => col.name === 'purchase_spreadsheet_url');

      if (!hasSalesSyncUrl) {
        console.log('🔄 Adding sales_spreadsheet_url to hometax_sync_operations...');
        db.exec('ALTER TABLE hometax_sync_operations ADD COLUMN sales_spreadsheet_url TEXT');
      }

      if (!hasPurchaseSyncUrl) {
        console.log('🔄 Adding purchase_spreadsheet_url to hometax_sync_operations...');
        db.exec('ALTER TABLE hometax_sync_operations ADD COLUMN purchase_spreadsheet_url TEXT');
      }
    }

    console.log('✅ Hometax spreadsheet URL columns migration completed');
  } catch (error) {
    console.error('❌ Error adding Hometax spreadsheet URL columns:', error);
    throw error;
  }
}
