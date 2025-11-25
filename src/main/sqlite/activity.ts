import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export interface ActivityLog {
  id: string;
  type: string;
  action: string;
  target?: string;
  details?: any;
  status: 'success' | 'failure' | 'pending' | 'info';
  errorMessage?: string;
  userId?: string;
  createdAt: string;
  metadata?: any;
}

export type CreateActivityLog = Omit<ActivityLog, 'id' | 'createdAt'>;

export class SQLiteActivityManager {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Create a new activity log entry
   */
  createActivity(data: CreateActivityLog): ActivityLog {
    const id = randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO activity_logs (
        id, type, action, target, details, status, error_message, user_id, created_at, metadata
      ) VALUES (
        @id, @type, @action, @target, @details, @status, @errorMessage, @userId, @createdAt, @metadata
      )
    `);

    const log: ActivityLog = {
      id,
      createdAt: now,
      ...data
    };

    try {
      stmt.run({
        id: log.id,
        type: log.type,
        action: log.action,
        target: log.target || null,
        details: log.details ? JSON.stringify(log.details) : null,
        status: log.status,
        errorMessage: log.errorMessage || null,
        userId: log.userId || null,
        createdAt: log.createdAt,
        metadata: log.metadata ? JSON.stringify(log.metadata) : null
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
      // We don't throw here to prevent logging failures from breaking the app flow
    }

    return log;
  }

  /**
   * Get recent activities
   */
  getRecentActivities(limit: number = 100, offset: number = 0, filters?: { type?: string; status?: string }): ActivityLog[] {
    let query = `
      SELECT * FROM activity_logs
    `;
    
    const params: any[] = [];
    const conditions: string[] = [];

    if (filters?.type) {
      conditions.push('type = ?');
      params.push(filters.type);
    }

    if (filters?.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      type: row.type,
      action: row.action,
      target: row.target,
      details: row.details ? JSON.parse(row.details) : undefined,
      status: row.status,
      errorMessage: row.error_message,
      userId: row.user_id,
      createdAt: row.created_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  }

  /**
   * Clear old logs (maintenance)
   */
  clearOldLogs(daysToKeep: number = 30): void {
    const stmt = this.db.prepare(`
      DELETE FROM activity_logs 
      WHERE created_at < date('now', '-' || ? || ' days')
    `);
    stmt.run(daysToKeep);
  }
}

export function initializeActivityDatabaseSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT,
      details TEXT,
      status TEXT CHECK(status IN ('success', 'failure', 'pending', 'info')),
      error_message TEXT,
      user_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT
    );
    
    CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON activity_logs(type);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_status ON activity_logs(status);
  `);
}

