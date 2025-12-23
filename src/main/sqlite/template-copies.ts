import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export interface TemplateCopy {
  id: string;
  templateId: string; // Original template spreadsheet ID
  templateScriptId?: string; // Original template Apps Script ID
  spreadsheetId: string; // Production spreadsheet ID
  spreadsheetUrl: string; // Production spreadsheet URL
  scriptId?: string; // Production Apps Script ID (bound to prod spreadsheet)
  devSpreadsheetId?: string; // Development spreadsheet ID
  devSpreadsheetUrl?: string; // Development spreadsheet URL
  devScriptId?: string; // Development Apps Script ID (bound to dev spreadsheet)
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
        script_id, dev_spreadsheet_id, dev_spreadsheet_url, dev_script_id, 
        script_content, created_at, metadata
      ) VALUES (
        @id, @templateId, @templateScriptId, @spreadsheetId, @spreadsheetUrl,
        @scriptId, @devSpreadsheetId, @devSpreadsheetUrl, @devScriptId,
        @scriptContent, @createdAt, @metadata
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
      devSpreadsheetId: copy.devSpreadsheetId || null,
      devSpreadsheetUrl: copy.devSpreadsheetUrl || null,
      devScriptId: copy.devScriptId || null,
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
      devSpreadsheetId: row.dev_spreadsheet_id,
      devSpreadsheetUrl: row.dev_spreadsheet_url,
      devScriptId: row.dev_script_id,
      scriptContent: row.script_content ? JSON.parse(row.script_content) : undefined,
      createdAt: row.created_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }

  /**
   * Get a template copy by script ID (checks both prod and dev script IDs)
   */
  getTemplateCopyByScriptId(scriptId: string): TemplateCopy | null {
    const stmt = this.db.prepare(`
      SELECT * FROM template_copies WHERE script_id = ? OR dev_script_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    const row = stmt.get(scriptId, scriptId) as any;
    
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
      devSpreadsheetId: row.dev_spreadsheet_id,
      devSpreadsheetUrl: row.dev_spreadsheet_url,
      devScriptId: row.dev_script_id,
      scriptContent: row.script_content ? JSON.parse(row.script_content) : undefined,
      createdAt: row.created_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }

  /**
   * Update template copy script content
   */
  updateTemplateCopyScriptContent(scriptId: string, scriptContent: any): boolean {
    try {
      const stmt = this.db.prepare(`
        UPDATE template_copies 
        SET script_content = ?
        WHERE script_id = ? OR dev_script_id = ?
      `);
      
      const contentStr = JSON.stringify(scriptContent);
      const result = stmt.run(contentStr, scriptId, scriptId);
      
      if (result.changes === 0) {
        console.warn(`⚠️ No template copy found with script_id or dev_script_id: ${scriptId}`);
        
        // Debug: list some IDs to see what we have
        const debugStmt = this.db.prepare(`SELECT script_id, dev_script_id FROM template_copies LIMIT 5`);
        const existing = debugStmt.all();
        console.log('🔍 Existing script IDs in DB:', existing);
      } else {
        console.log(`✅ Updated script content for ${scriptId} (${result.changes} rows)`);
      }
      
      return result.changes > 0;
    } catch (error) {
      console.error(`❌ Error updating template copy script content for ${scriptId}:`, error);
      return false;
    }
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
      devSpreadsheetId: row.dev_spreadsheet_id,
      devSpreadsheetUrl: row.dev_spreadsheet_url,
      devScriptId: row.dev_script_id,
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
      devSpreadsheetId: row.dev_spreadsheet_id,
      devSpreadsheetUrl: row.dev_spreadsheet_url,
      devScriptId: row.dev_script_id,
      scriptContent: row.script_content ? JSON.parse(row.script_content) : undefined,
      createdAt: row.created_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  }

  /**
   * Update the dev script ID for a template copy
   */
  updateDevScriptId(id: string, devScriptId: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE template_copies 
      SET dev_script_id = ?
      WHERE id = ?
    `);
    
    const result = stmt.run(devScriptId, id);
    return result.changes > 0;
  }

  /**
   * Update the dev environment info for a template copy
   */
  updateDevEnvironment(id: string, devInfo: { 
    devSpreadsheetId: string; 
    devSpreadsheetUrl: string; 
    devScriptId: string; 
  }): boolean {
    const stmt = this.db.prepare(`
      UPDATE template_copies 
      SET dev_spreadsheet_id = ?, dev_spreadsheet_url = ?, dev_script_id = ?
      WHERE id = ?
    `);
    
    const result = stmt.run(
      devInfo.devSpreadsheetId, 
      devInfo.devSpreadsheetUrl, 
      devInfo.devScriptId, 
      id
    );
    return result.changes > 0;
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
  // First, check if the table exists and run migrations BEFORE creating
  try {
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='template_copies'
    `).get();
    
    if (tableExists) {
      // Table exists, run migrations to add missing columns
      const tableInfo = db.pragma('table_info(template_copies)') as any[];
      const columns = tableInfo.map(col => col.name);
      
      if (!columns.includes('dev_script_id')) {
        console.log('📦 Migrating template_copies table: adding dev_script_id column...');
        db.exec(`ALTER TABLE template_copies ADD COLUMN dev_script_id TEXT`);
        console.log('✅ Migration complete: dev_script_id column added');
      }
      
      if (!columns.includes('dev_spreadsheet_id')) {
        console.log('📦 Migrating template_copies table: adding dev_spreadsheet_id column...');
        db.exec(`ALTER TABLE template_copies ADD COLUMN dev_spreadsheet_id TEXT`);
        console.log('✅ Migration complete: dev_spreadsheet_id column added');
      }
      
      if (!columns.includes('dev_spreadsheet_url')) {
        console.log('📦 Migrating template_copies table: adding dev_spreadsheet_url column...');
        db.exec(`ALTER TABLE template_copies ADD COLUMN dev_spreadsheet_url TEXT`);
        console.log('✅ Migration complete: dev_spreadsheet_url column added');
      }
      
      // Create indexes after migration
      db.exec(`CREATE INDEX IF NOT EXISTS idx_template_copies_dev_script_id ON template_copies(dev_script_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_template_copies_dev_spreadsheet_id ON template_copies(dev_spreadsheet_id)`);
      
      console.log('✅ template_copies table migrations complete');
    } else {
      // Table doesn't exist, create it with all columns
      db.exec(`
        CREATE TABLE template_copies (
          id TEXT PRIMARY KEY,
          template_id TEXT NOT NULL,
          template_script_id TEXT,
          spreadsheet_id TEXT NOT NULL,
          spreadsheet_url TEXT NOT NULL,
          script_id TEXT,
          dev_spreadsheet_id TEXT,
          dev_spreadsheet_url TEXT,
          dev_script_id TEXT,
          script_content TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          metadata TEXT
        )
      `);
      
      console.log('✅ template_copies table created');
    }
    
    // Always ensure indexes exist
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_template_copies_template_id ON template_copies(template_id);
      CREATE INDEX IF NOT EXISTS idx_template_copies_spreadsheet_id ON template_copies(spreadsheet_id);
      CREATE INDEX IF NOT EXISTS idx_template_copies_created_at ON template_copies(created_at);
      CREATE INDEX IF NOT EXISTS idx_template_copies_dev_script_id ON template_copies(dev_script_id);
      CREATE INDEX IF NOT EXISTS idx_template_copies_dev_spreadsheet_id ON template_copies(dev_spreadsheet_id);
    `);
    
  } catch (error) {
    console.error('❌ Error initializing template_copies schema:', error);
    throw error;
  }
}

