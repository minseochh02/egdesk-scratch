import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

export interface CompanyResearchRecord {
  id: string;
  domain: string;
  companyName: string;
  status: 'completed' | 'failed' | 'in_progress';
  crawlData: any;
  summaryData: any;
  researchData: any;
  detailedReport: any;
  executiveSummary: any;
  localReportPath?: string;
  inquiryData: any;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export class SQLiteCompanyResearchManager {
  constructor(private db: Database.Database) {}

  /**
   * Create or update a company research record
   */
  public saveResearch(record: Partial<CompanyResearchRecord>): CompanyResearchRecord {
    const now = new Date().toISOString();
    const id = record.id || uuidv4();

    const existing = this.getResearchById(id);

    if (existing) {
      const stmt = this.db.prepare(`
        UPDATE company_research SET
          domain = COALESCE(?, domain),
          company_name = COALESCE(?, company_name),
          status = COALESCE(?, status),
          crawl_data = COALESCE(?, crawl_data),
          summary_data = COALESCE(?, summary_data),
          research_data = COALESCE(?, research_data),
          detailed_report = COALESCE(?, detailed_report),
          executive_summary = COALESCE(?, executive_summary),
          local_report_path = COALESCE(?, local_report_path),
          inquiry_data = COALESCE(?, inquiry_data),
          error = COALESCE(?, error),
          updated_at = ?
        WHERE id = ?
      `);

      stmt.run(
        record.domain || null,
        record.companyName || null,
        record.status || null,
        record.crawlData ? JSON.stringify(record.crawlData) : null,
        record.summaryData ? JSON.stringify(record.summaryData) : null,
        record.researchData ? JSON.stringify(record.researchData) : null,
        record.detailedReport ? JSON.stringify(record.detailedReport) : null,
        record.executiveSummary ? JSON.stringify(record.executiveSummary) : null,
        record.localReportPath || null,
        record.inquiryData ? JSON.stringify(record.inquiryData) : null,
        record.error || null,
        now,
        id
      );
    } else {
      const stmt = this.db.prepare(`
        INSERT INTO company_research (
          id, domain, company_name, status, crawl_data, summary_data, 
          research_data, detailed_report, executive_summary, local_report_path, 
          inquiry_data, error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        record.domain || '',
        record.companyName || '',
        record.status || 'in_progress',
        record.crawlData ? JSON.stringify(record.crawlData) : null,
        record.summaryData ? JSON.stringify(record.summaryData) : null,
        record.researchData ? JSON.stringify(record.researchData) : null,
        record.detailedReport ? JSON.stringify(record.detailedReport) : null,
        record.executiveSummary ? JSON.stringify(record.executiveSummary) : null,
        record.localReportPath || null,
        record.inquiryData ? JSON.stringify(record.inquiryData) : null,
        record.error || null,
        record.createdAt || now,
        now
      );
    }

    return this.getResearchById(id)!;
  }

  /**
   * Get all research records
   */
  public getAllResearch(): CompanyResearchRecord[] {
    const stmt = this.db.prepare('SELECT * FROM company_research ORDER BY created_at DESC');
    const rows = stmt.all();
    return rows.map(row => this.mapRowToRecord(row));
  }

  /**
   * Get research by ID
   */
  public getResearchById(id: string): CompanyResearchRecord | null {
    const stmt = this.db.prepare('SELECT * FROM company_research WHERE id = ?');
    const row = stmt.get(id);
    return row ? this.mapRowToRecord(row) : null;
  }

  /**
   * Update an existing research record (for progressive saves)
   */
  public updateResearch(id: string, updates: Partial<CompanyResearchRecord>): CompanyResearchRecord | null {
    const existing = this.getResearchById(id);
    if (!existing) {
      console.warn(`[SQLite] Cannot update research ${id}: not found`);
      return null;
    }

    return this.saveResearch({ ...updates, id });
  }

  /**
   * Delete a research record
   */
  public deleteResearch(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM company_research WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Find research by domain
   */
  public findByDomain(domain: string): CompanyResearchRecord[] {
    const stmt = this.db.prepare('SELECT * FROM company_research WHERE domain = ? ORDER BY created_at DESC');
    const rows = stmt.all(domain);
    return rows.map(row => this.mapRowToRecord(row));
  }

  /**
   * Get the most recent completed research for a domain
   */
  public getLatestCompletedResearch(domain: string): CompanyResearchRecord | null {
    const stmt = this.db.prepare(
      'SELECT * FROM company_research WHERE domain = ? AND status = ? ORDER BY created_at DESC LIMIT 1'
    );
    const row = stmt.get(domain, 'completed');
    return row ? this.mapRowToRecord(row) : null;
  }

  /**
   * Check if research exists for domain within a time window (in hours)
   */
  public hasRecentResearch(domain: string, hoursAgo: number = 24): boolean {
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
    const stmt = this.db.prepare(
      'SELECT COUNT(*) as count FROM company_research WHERE domain = ? AND status = ? AND created_at > ?'
    );
    const result = stmt.get(domain, 'completed', cutoffTime) as { count: number };
    return result.count > 0;
  }

  /**
   * Get research records with minimal data (excludes large fields for list views)
   */
  public getAllResearchMinimal(): Array<Omit<CompanyResearchRecord, 'crawlData' | 'researchData'>> {
    const stmt = this.db.prepare(`
      SELECT 
        id, domain, company_name, status, local_report_path,
        summary_data, detailed_report, executive_summary,
        inquiry_data, error, created_at, updated_at
      FROM company_research 
      ORDER BY created_at DESC
    `);
    const rows = stmt.all();
    return rows.map(row => ({
      id: row.id,
      domain: row.domain,
      companyName: row.company_name,
      status: row.status,
      summaryData: row.summary_data ? JSON.parse(row.summary_data) : null,
      detailedReport: row.detailed_report ? JSON.parse(row.detailed_report) : null,
      executiveSummary: row.executive_summary ? JSON.parse(row.executive_summary) : null,
      localReportPath: row.local_report_path,
      inquiryData: row.inquiry_data ? JSON.parse(row.inquiry_data) : null,
      error: row.error,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  private mapRowToRecord(row: any): CompanyResearchRecord {
    return {
      id: row.id,
      domain: row.domain,
      companyName: row.company_name,
      status: row.status,
      crawlData: row.crawl_data ? JSON.parse(row.crawl_data) : null,
      summaryData: row.summary_data ? JSON.parse(row.summary_data) : null,
      researchData: row.research_data ? JSON.parse(row.research_data) : null,
      detailedReport: row.detailed_report ? JSON.parse(row.detailed_report) : null,
      executiveSummary: row.executive_summary ? JSON.parse(row.executive_summary) : null,
      localReportPath: row.local_report_path,
      inquiryData: row.inquiry_data ? JSON.parse(row.inquiry_data) : null,
      error: row.error,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

/**
 * Initialize company research database schema
 * 
 * Data Storage Strategy:
 * - Simple fields (domain, status, etc.) stored as TEXT
 * - Complex objects (crawlData, summaryData, etc.) stored as JSON-stringified TEXT
 * - Large fields (crawl_data, research_data) can make records 10-100MB each
 * - Consider using getAllResearchMinimal() for list views to avoid loading large fields
 * - The detailed report is also saved as a local .md file (local_report_path)
 */
export function initializeCompanyResearchSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS company_research (
      id TEXT PRIMARY KEY,
      domain TEXT NOT NULL,
      company_name TEXT,
      status TEXT NOT NULL,
      crawl_data TEXT,
      summary_data TEXT,
      research_data TEXT,
      detailed_report TEXT,
      executive_summary TEXT,
      local_report_path TEXT,
      inquiry_data TEXT,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_company_research_domain ON company_research(domain);
    CREATE INDEX IF NOT EXISTS idx_company_research_status ON company_research(status);
    CREATE INDEX IF NOT EXISTS idx_company_research_created_at ON company_research(created_at);
    CREATE INDEX IF NOT EXISTS idx_company_research_domain_status ON company_research(domain, status);
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_company_research_timestamp 
    AFTER UPDATE ON company_research
    BEGIN
      UPDATE company_research SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END
  `);
}

