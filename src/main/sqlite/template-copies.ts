import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export interface TemplateCopy {
  id: string;
  templateId: string; // Original template spreadsheet ID
  templateScriptId?: string; // Original template Apps Script ID
  spreadsheetId: string; // New copied spreadsheet ID
  spreadsheetUrl: string;
  scriptId?: string; // New copied Apps Script ID
  scriptContent?: any; // Full Apps Script content (files with source code)
  createdAt: string;
  metadata?: any;
}

export type CreateTemplateCopyData = Omit<TemplateCopy, 'id' | 'createdAt'>;

export class SQLiteTemplateCopiesManager {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Create a new template copy record
   */
  createTemplateCopy(data: CreateTemplateCopyData): TemplateCopy {
    const id = randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO template_copies (
        id, template_id, template_script_id, spreadsheet_id, spreadsheet_url, 
        script_id, script_content, created_at, metadata
      ) VALUES (
        @id, @templateId, @templateScriptId, @spreadsheetId, @spreadsheetUrl,
        @scriptId, @scriptContent, @createdAt, @metadata
      )
    `);

    const copy: TemplateCopy = {
      id,
      createdAt: now,
      ...data
    };

    stmt.run({
      id: copy.id,
      templateId: copy.templateId,
      templateScriptId: copy.templateScriptId || null,
      spreadsheetId: copy.spreadsheetId,
      spreadsheetUrl: copy.spreadsheetUrl,
      scriptId: copy.scriptId || null,
      scriptContent: copy.scriptContent ? JSON.stringify(copy.scriptContent) : null,
      createdAt: copy.createdAt,
      metadata: copy.metadata ? JSON.stringify(copy.metadata) : null
    });

    return copy;
  }

  /**
   * Get a template copy by ID
   */
  getTemplateCopy(id: string): TemplateCopy | null {
    const stmt = this.db.prepare(`
      SELECT * FROM template_copies WHERE id = ?
    `);
    
    const row = stmt.get(id) as any;
    
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      templateId: row.template_id,
      templateScriptId: row.template_script_id,
      spreadsheetId: row.spreadsheet_id,
      spreadsheetUrl: row.spreadsheet_url,
      scriptId: row.script_id,
      scriptContent: row.script_content ? JSON.parse(row.script_content) : undefined,
      createdAt: row.created_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }

  /**
   * Get all template copies for a specific template
   */
  getTemplateCopiesByTemplateId(templateId: string): TemplateCopy[] {
    const stmt = this.db.prepare(`
      SELECT * FROM template_copies 
      WHERE template_id = ?
      ORDER BY created_at DESC
    `);
    
    const rows = stmt.all(templateId) as any[];
    
    return rows.map(row => ({
      id: row.id,
      templateId: row.template_id,
      templateScriptId: row.template_script_id,
      spreadsheetId: row.spreadsheet_id,
      spreadsheetUrl: row.spreadsheet_url,
      scriptId: row.script_id,
      scriptContent: row.script_content ? JSON.parse(row.script_content) : undefined,
      createdAt: row.created_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  }

  /**
   * Get all template copies
   */
  getAllTemplateCopies(limit: number = 100, offset: number = 0): TemplateCopy[] {
    const stmt = this.db.prepare(`
      SELECT * FROM template_copies 
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    
    const rows = stmt.all(limit, offset) as any[];
    
    return rows.map(row => ({
      id: row.id,
      templateId: row.template_id,
      templateScriptId: row.template_script_id,
      spreadsheetId: row.spreadsheet_id,
      spreadsheetUrl: row.spreadsheet_url,
      scriptId: row.script_id,
      scriptContent: row.script_content ? JSON.parse(row.script_content) : undefined,
      createdAt: row.created_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  }

  /**
   * Delete a template copy record
   */
  deleteTemplateCopy(id: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM template_copies WHERE id = ?
    `);
    
    const result = stmt.run(id);
    return result.changes > 0;
  }
}

export function initializeTemplateCopiesDatabaseSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS template_copies (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      template_script_id TEXT,
      spreadsheet_id TEXT NOT NULL,
      spreadsheet_url TEXT NOT NULL,
      script_id TEXT,
      script_content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT
    );
    
    CREATE INDEX IF NOT EXISTS idx_template_copies_template_id ON template_copies(template_id);
    CREATE INDEX IF NOT EXISTS idx_template_copies_spreadsheet_id ON template_copies(spreadsheet_id);
    CREATE INDEX IF NOT EXISTS idx_template_copies_created_at ON template_copies(created_at);
  `);
}

