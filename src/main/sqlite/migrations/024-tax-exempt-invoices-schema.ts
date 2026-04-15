import Database from 'better-sqlite3';

export function createTaxExemptInvoicesSchema(db: Database.Database) {
  console.log('🔄 Creating Tax Exempt Invoices schema...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS tax_exempt_invoices (
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

      -- 계산서 분류
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

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tax_exempt_invoices_business ON tax_exempt_invoices(business_number);
    CREATE INDEX IF NOT EXISTS idx_tax_exempt_invoices_type ON tax_exempt_invoices(invoice_type);
    CREATE INDEX IF NOT EXISTS idx_tax_exempt_invoices_date ON tax_exempt_invoices(작성일자);
    CREATE INDEX IF NOT EXISTS idx_tax_exempt_invoices_approval ON tax_exempt_invoices(승인번호);
  `);

  // Add spreadsheet URL columns to hometax_connections
  try {
    db.exec(`
      ALTER TABLE hometax_connections
      ADD COLUMN tax_exempt_sales_spreadsheet_url TEXT;
    `);
  } catch (error: any) {
    if (!error.message.includes('duplicate column name')) throw error;
  }

  try {
    db.exec(`
      ALTER TABLE hometax_connections
      ADD COLUMN tax_exempt_purchase_spreadsheet_url TEXT;
    `);
  } catch (error: any) {
    if (!error.message.includes('duplicate column name')) throw error;
  }

  console.log('✅ Tax Exempt Invoices schema created successfully');
}
