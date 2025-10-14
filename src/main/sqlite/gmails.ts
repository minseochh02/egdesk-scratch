// Gmail Database Manager - SQLite storage for Gmail data
import Database from 'better-sqlite3';
import { getSQLiteManager } from './manager';

export interface GmailMessageRecord {
  id: string;
  userEmail: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  isRead: boolean;
  isImportant: boolean;
  labels: string;
  threadId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GmailStatsRecord {
  id: string;
  userEmail: string;
  totalMessages: number;
  unreadMessages: number;
  importantMessages: number;
  sentMessages: number;
  recentActivity: number;
  createdAt: string;
  updatedAt: string;
}

export interface DomainUserRecord {
  id: string;
  email: string;
  name: string;
  displayName: string;
  isAdmin: boolean;
  isSuspended: boolean;
  lastLoginTime?: string;
  createdAt: string;
  updatedAt: string;
}

export class GmailDatabase {
  private db: Database.Database;

  constructor() {
    // Use the existing SQLite manager's conversations database instance
    const sqliteManager = getSQLiteManager();
    this.db = sqliteManager.getConversationsDatabase();
  }

  /**
   * Initialize the database with required tables
   */
  async initialize(): Promise<void> {
    // Create domain users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS domain_users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        display_name TEXT NOT NULL,
        is_admin BOOLEAN DEFAULT 0,
        is_suspended BOOLEAN DEFAULT 0,
        last_login_time TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Create Gmail messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS gmail_messages (
        id TEXT PRIMARY KEY,
        user_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        from_email TEXT NOT NULL,
        to_email TEXT NOT NULL,
        date TEXT NOT NULL,
        snippet TEXT NOT NULL,
        is_read BOOLEAN DEFAULT 0,
        is_important BOOLEAN DEFAULT 0,
        labels TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_email) REFERENCES domain_users (email)
      )
    `);

    // Create Gmail stats table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS gmail_stats (
        id TEXT PRIMARY KEY,
        user_email TEXT NOT NULL,
        total_messages INTEGER DEFAULT 0,
        unread_messages INTEGER DEFAULT 0,
        important_messages INTEGER DEFAULT 0,
        sent_messages INTEGER DEFAULT 0,
        recent_activity INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_email) REFERENCES domain_users (email)
      )
    `);

    // Create indexes for better performance
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_user_email ON gmail_messages (user_email)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_date ON gmail_messages (date)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_stats_user_email ON gmail_stats (user_email)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON domain_users (email)`);
  }

  /**
   * Save domain users to database
   */
  async saveDomainUsers(users: DomainUserRecord[]): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO domain_users 
      (id, email, name, display_name, is_admin, is_suspended, last_login_time, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((users: DomainUserRecord[]) => {
      for (const user of users) {
        stmt.run([
          user.id,
          user.email,
          user.name,
          user.displayName,
          user.isAdmin ? 1 : 0,
          user.isSuspended ? 1 : 0,
          user.lastLoginTime || null,
          user.createdAt,
          user.updatedAt
        ]);
      }
    });

    insertMany(users);
  }

  /**
   * Save Gmail messages for a user
   */
  async saveUserMessages(userEmail: string, messages: GmailMessageRecord[]): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO gmail_messages 
      (id, user_email, subject, from_email, to_email, date, snippet, is_read, is_important, labels, thread_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((messages: GmailMessageRecord[]) => {
      for (const message of messages) {
        stmt.run([
          message.id,
          message.userEmail,
          message.subject,
          message.from,
          message.to,
          message.date,
          message.snippet,
          message.isRead ? 1 : 0,
          message.isImportant ? 1 : 0,
          message.labels,
          message.threadId,
          message.createdAt,
          message.updatedAt
        ]);
      }
    });

    insertMany(messages);
  }

  /**
   * Save Gmail stats for a user
   */
  async saveUserStats(userEmail: string, stats: GmailStatsRecord): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO gmail_stats 
      (id, user_email, total_messages, unread_messages, important_messages, sent_messages, recent_activity, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      stats.id,
      stats.userEmail,
      stats.totalMessages,
      stats.unreadMessages,
      stats.importantMessages,
      stats.sentMessages,
      stats.recentActivity,
      stats.createdAt,
      stats.updatedAt
    ]);
  }

  /**
   * Get all domain users from database
   */
  async getDomainUsers(): Promise<DomainUserRecord[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM domain_users 
      ORDER BY email ASC
    `);
    
    const rows = stmt.all() as any[];
    
    return rows.map(row => ({
      id: row.id,
      email: row.email,
      name: row.name,
      displayName: row.display_name,
      isAdmin: row.is_admin === 1,
      isSuspended: row.is_suspended === 1,
      lastLoginTime: row.last_login_time,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  /**
   * Get Gmail messages for a user
   */
  async getUserMessages(userEmail: string, limit?: number): Promise<GmailMessageRecord[]> {
    const query = limit 
      ? `SELECT * FROM gmail_messages WHERE user_email = ? ORDER BY date DESC LIMIT ?`
      : `SELECT * FROM gmail_messages WHERE user_email = ? ORDER BY date DESC`;
    
    const params = limit ? [userEmail, limit] : [userEmail];
    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      userEmail: row.user_email,
      subject: row.subject,
      from: row.from_email,
      to: row.to_email,
      date: row.date,
      snippet: row.snippet,
      isRead: row.is_read === 1,
      isImportant: row.is_important === 1,
      labels: row.labels,
      threadId: row.thread_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  /**
   * Get Gmail stats for a user
   */
  async getUserStats(userEmail: string): Promise<GmailStatsRecord | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM gmail_stats WHERE user_email = ?
    `);
    
    const row = stmt.get(userEmail) as any;
    
    if (row) {
      return {
        id: row.id,
        userEmail: row.user_email,
        totalMessages: row.total_messages,
        unreadMessages: row.unread_messages,
        importantMessages: row.important_messages,
        sentMessages: row.sent_messages,
        recentActivity: row.recent_activity,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    }
    
    return null;
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<{
    totalUsers: number;
    totalMessages: number;
    totalStats: number;
    lastUpdated: string;
  }> {
    const userCountStmt = this.db.prepare('SELECT COUNT(*) as count FROM domain_users');
    const messageCountStmt = this.db.prepare('SELECT COUNT(*) as count FROM gmail_messages');
    const statsCountStmt = this.db.prepare('SELECT COUNT(*) as count FROM gmail_stats');
    const lastUpdatedStmt = this.db.prepare('SELECT MAX(updated_at) as last_updated FROM gmail_messages');

    const userCount = (userCountStmt.get() as any).count;
    const messageCount = (messageCountStmt.get() as any).count;
    const statsCount = (statsCountStmt.get() as any).count;
    const lastUpdated = (lastUpdatedStmt.get() as any).last_updated || '';

    return {
      totalUsers: userCount,
      totalMessages: messageCount,
      totalStats: statsCount,
      lastUpdated
    };
  }
}
