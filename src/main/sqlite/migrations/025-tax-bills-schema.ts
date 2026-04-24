import Database from 'better-sqlite3';

export function createTaxBillsSchema(db: Database.Database) {
  console.log('🔄 Resetting and Creating Tax Bills schema...');

  // Drop existing tables to allow for schema changes during development
  db.exec(`
    DROP TABLE IF EXISTS tax_payments;
    DROP TABLE IF EXISTS tax_documents;
    DROP TABLE IF EXISTS tax_items;
    DROP TABLE IF EXISTS tax_entities;
  `);

  // 1. 납세 기업 정보 (tax_entities)
  db.exec(`
    CREATE TABLE IF NOT EXISTS tax_entities (
      entity_id INTEGER PRIMARY KEY AUTOINCREMENT,
      biz_reg_no TEXT NOT NULL UNIQUE,
      company_name TEXT NOT NULL,
      representative_name TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. 세목 마스터 (tax_items)
  db.exec(`
    CREATE TABLE IF NOT EXISTS tax_items (
      item_id TEXT PRIMARY KEY, -- 세목 코드 (e.g., '41')
      tax_category TEXT NOT NULL, -- 국세 / 지방세
      item_name TEXT NOT NULL, -- 세목명 (예: 부가가치세)
      is_self_reported BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 3. 세무 고지/신고 통합 테이블 (tax_documents)
  db.exec(`
    CREATE TABLE IF NOT EXISTS tax_documents (
      doc_id TEXT PRIMARY KEY,
      entity_id INTEGER NOT NULL,
      item_id NOT NULL,
      tax_category TEXT NOT NULL CHECK (tax_category IN ('NATIONAL', 'LOCAL')),
      period_year INTEGER NOT NULL,
      period_detail TEXT,                      -- 1기, 7월분 등
      issue_date TEXT,                         -- DATE
      due_date TEXT NOT NULL,                  -- DATE
      
      -- 금액 정보
      tax_base_amount INTEGER DEFAULT 0,       -- 과세표준
      main_tax_amount INTEGER NOT NULL,        -- 본세
      edu_tax_amount INTEGER DEFAULT 0,        -- 교육세
      rural_tax_amount INTEGER DEFAULT 0,      -- 농어촌특별세
      total_amount INTEGER NOT NULL,           -- 합계금액
      
      -- 관리 정보
      virtual_account TEXT,                    -- 가상계좌번호
      notice_number TEXT,                      -- 전자고지번호 (가상계좌 연결용)
      bill_html_path TEXT,                     -- 고지서 HTML 파일 경로
      status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entity_id) REFERENCES tax_entities(entity_id),
      FOREIGN KEY (item_id) REFERENCES tax_items(item_id)
    );
  `);

  // 4. 납부 상태 및 이력 (tax_payments)
  db.exec(`
    CREATE TABLE IF NOT EXISTS tax_payments (
      payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_id TEXT NOT NULL,
      paid_amount INTEGER NOT NULL,
      paid_date TEXT, -- YYYY-MM-DD
      payment_method TEXT,
      status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (doc_id) REFERENCES tax_documents(doc_id) ON DELETE CASCADE
    );
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tax_entities_biz_no ON tax_entities(biz_reg_no);
    CREATE INDEX IF NOT EXISTS idx_tax_documents_entity ON tax_documents(entity_id);
    CREATE INDEX IF NOT EXISTS idx_tax_documents_item ON tax_documents(item_id);
    CREATE INDEX IF NOT EXISTS idx_tax_documents_due_date ON tax_documents(due_date);
    CREATE INDEX IF NOT EXISTS idx_tax_documents_status ON tax_documents(status);
    CREATE INDEX IF NOT EXISTS idx_tax_payments_doc ON tax_payments(doc_id);
  `);

  console.log('✅ Tax Bills schema updated to match requested SQL rule');
}
