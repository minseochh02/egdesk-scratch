import Database from 'better-sqlite3';

export function createHometaxSchema(db: Database.Database) {
  console.log('🔄 Creating Hometax schema...');

  // 1. Hometax Connections Table
  console.log('📊 Creating hometax_connections table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS hometax_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_number TEXT NOT NULL UNIQUE,
      business_name TEXT,
      representative_name TEXT,
      business_type TEXT,
      connection_status TEXT DEFAULT 'disconnected',
      last_connected_at DATETIME,
      sales_count INTEGER DEFAULT 0,
      purchase_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Tax Invoices Table (matching Excel structure - 33 columns)
  console.log('📋 Creating tax_invoices table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS tax_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_number TEXT NOT NULL,
      invoice_type TEXT NOT NULL,

      -- 작성일자, 승인번호, 발급일자, 전송일자
      작성일자 TEXT,
      승인번호 TEXT NOT NULL,
      발급일자 TEXT,
      전송일자 TEXT,

      -- 공급자 정보
      공급자사업자등록번호 TEXT,
      공급자종사업장번호 TEXT,
      공급자상호 TEXT,
      공급자대표자명 TEXT,
      공급자주소 TEXT,

      -- 공급받는자 정보
      공급받는자사업자등록번호 TEXT,
      공급받는자종사업장번호 TEXT,
      공급받는자상호 TEXT,
      공급받는자대표자명 TEXT,
      공급받는자주소 TEXT,

      -- 금액 정보
      합계금액 INTEGER,
      공급가액 INTEGER,
      세액 INTEGER,

      -- 세금계산서 분류
      전자세금계산서분류 TEXT,
      전자세금계산서종류 TEXT,
      발급유형 TEXT,
      비고 TEXT,
      영수청구구분 TEXT,

      -- 이메일
      공급자이메일 TEXT,
      공급받는자이메일1 TEXT,
      공급받는자이메일2 TEXT,

      -- 품목 정보
      품목일자 TEXT,
      품목명 TEXT,
      품목규격 TEXT,
      품목수량 TEXT,
      품목단가 TEXT,
      품목공급가액 INTEGER,
      품목세액 INTEGER,
      품목비고 TEXT,

      -- Excel file reference
      excel_file_path TEXT,

      -- Metadata
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

      UNIQUE(business_number, 승인번호)
    );
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tax_invoices_business ON tax_invoices(business_number);
    CREATE INDEX IF NOT EXISTS idx_tax_invoices_type ON tax_invoices(invoice_type);
    CREATE INDEX IF NOT EXISTS idx_tax_invoices_date ON tax_invoices(작성일자);
    CREATE INDEX IF NOT EXISTS idx_tax_invoices_approval ON tax_invoices(승인번호);
  `);

  // 3. Hometax Sync Operations Table
  console.log('🔄 Creating hometax_sync_operations table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS hometax_sync_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_number TEXT NOT NULL,
      status TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      sales_count INTEGER DEFAULT 0,
      sales_new INTEGER DEFAULT 0,
      sales_duplicate INTEGER DEFAULT 0,
      purchase_count INTEGER DEFAULT 0,
      purchase_new INTEGER DEFAULT 0,
      purchase_duplicate INTEGER DEFAULT 0,
      sales_excel_path TEXT,
      purchase_excel_path TEXT,
      error_message TEXT,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      duration INTEGER
    );
  `);

  console.log('✅ Hometax schema created successfully');
}
