import Database from 'better-sqlite3';

export function createCashReceiptsSchema(db: Database.Database) {
  console.log('🔄 Creating Cash Receipts schema...');

  // Cash Receipts Table
  console.log('📋 Creating cash_receipts table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS cash_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_number TEXT NOT NULL,

      -- Cash receipt fields (현금영수증 매출내역)
      발행구분 TEXT,
      매출일시 TEXT,
      공급가액 INTEGER,
      부가세 INTEGER,
      봉사료 INTEGER,
      총금액 INTEGER,
      승인번호 TEXT NOT NULL,
      신분확인뒷4자리 TEXT,
      거래구분 TEXT,
      용도구분 TEXT,
      비고 TEXT,

      -- Excel file reference
      excel_file_path TEXT,

      -- Metadata
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

      UNIQUE(business_number, 승인번호, 매출일시)
    );
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_cash_receipts_business ON cash_receipts(business_number);
    CREATE INDEX IF NOT EXISTS idx_cash_receipts_date ON cash_receipts(매출일시);
    CREATE INDEX IF NOT EXISTS idx_cash_receipts_approval ON cash_receipts(승인번호);
  `);

  // Add cash_receipt_spreadsheet_url column to hometax_connections if it doesn't exist
  console.log('🔧 Adding cash_receipt_spreadsheet_url to hometax_connections...');
  try {
    db.exec(`
      ALTER TABLE hometax_connections
      ADD COLUMN cash_receipt_spreadsheet_url TEXT;
    `);
    console.log('✅ Added cash_receipt_spreadsheet_url column');
  } catch (error: any) {
    if (error.message.includes('duplicate column name')) {
      console.log('ℹ️  Column cash_receipt_spreadsheet_url already exists');
    } else {
      throw error;
    }
  }

  // Add cash receipt counts to hometax_connections if they don't exist
  console.log('🔧 Adding cash_receipt_count to hometax_connections...');
  try {
    db.exec(`
      ALTER TABLE hometax_connections
      ADD COLUMN cash_receipt_count INTEGER DEFAULT 0;
    `);
    console.log('✅ Added cash_receipt_count column');
  } catch (error: any) {
    if (error.message.includes('duplicate column name')) {
      console.log('ℹ️  Column cash_receipt_count already exists');
    } else {
      throw error;
    }
  }

  console.log('✅ Cash Receipts schema created successfully');
}
