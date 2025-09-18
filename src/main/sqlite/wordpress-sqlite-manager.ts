import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

export interface WordPressPost {
  id: number;
  title: string;
  content: string;
  excerpt: string;
  slug: string;
  status: string;
  type: string;
  author: number;
  featured_media: number;
  parent: number;
  menu_order: number;
  comment_status: string;
  ping_status: string;
  template: string;
  format: string;
  meta: string; // JSON string
  date: string;
  date_gmt: string;
  modified: string;
  modified_gmt: string;
  link: string;
  guid: string;
  wordpress_site_id: string;
  synced_at: string;
  local_content?: string; // For different export formats
  export_format?: string; // 'wordpress', 'markdown', 'html', etc.
}

export interface WordPressMedia {
  id: number;
  title: string;
  description: string;
  caption: string;
  alt_text: string;
  source_url: string;
  mime_type: string;
  file_name: string;
  file_size: number;
  width: number;
  height: number;
  wordpress_site_id: string;
  synced_at: string;
  local_path?: string;
  local_data?: Buffer; // Binary data for images
}

export interface SyncOperation {
  id: string;
  site_id: string;
  site_name: string;
  operation_type: 'full_sync' | 'posts_only' | 'media_only' | 'incremental';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  start_time: string;
  end_time?: string;
  total_posts: number;
  synced_posts: number;
  total_media: number;
  synced_media: number;
  errors: string; // JSON string of error messages
  export_format: string;
  local_path?: string; // For backward compatibility
  created_at: string;
}

export interface SyncFileDetail {
  id: string;
  sync_operation_id: string;
  file_type: 'post' | 'media' | 'export';
  file_name: string;
  file_path: string;
  file_size: number;
  status: 'pending' | 'synced' | 'failed' | 'skipped';
  error_message?: string;
  synced_at?: string;
  wordpress_id?: number;
  wordpress_url?: string;
}

export interface SyncStats {
  totalPosts: number;
  totalMedia: number;
  totalSyncOperations: number;
  lastSyncTime: string | null;
  totalFileSize: number;
}

export class WordPressSQLiteManager {
  private db: Database.Database;
  private dbPath: string;

  constructor() {
    // Create data directory if it doesn't exist
    const dataDir = path.join(app.getPath('userData'), 'wordpress-sync');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.dbPath = path.join(dataDir, 'wordpress-sync.db');
    this.db = new Database(this.dbPath);
    this.initializeDatabase();
  }

  private initializeDatabase() {
    // Create WordPress posts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS wordpress_posts (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        excerpt TEXT,
        slug TEXT NOT NULL,
        status TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'post',
        author INTEGER NOT NULL,
        featured_media INTEGER,
        parent INTEGER DEFAULT 0,
        menu_order INTEGER DEFAULT 0,
        comment_status TEXT DEFAULT 'open',
        ping_status TEXT DEFAULT 'open',
        template TEXT,
        format TEXT DEFAULT 'standard',
        meta TEXT, -- JSON string
        date TEXT NOT NULL,
        date_gmt TEXT NOT NULL,
        modified TEXT NOT NULL,
        modified_gmt TEXT NOT NULL,
        link TEXT NOT NULL,
        guid TEXT NOT NULL,
        wordpress_site_id TEXT NOT NULL,
        synced_at TEXT NOT NULL,
        local_content TEXT,
        export_format TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create WordPress media table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS wordpress_media (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        caption TEXT,
        alt_text TEXT,
        source_url TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size INTEGER,
        width INTEGER,
        height INTEGER,
        wordpress_site_id TEXT NOT NULL,
        synced_at TEXT NOT NULL,
        local_path TEXT,
        local_data BLOB, -- Binary data for images
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create sync operations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_operations (
        id TEXT PRIMARY KEY,
        site_id TEXT NOT NULL,
        site_name TEXT NOT NULL,
        operation_type TEXT NOT NULL CHECK (operation_type IN ('full_sync', 'posts_only', 'media_only', 'incremental')),
        status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
        start_time TEXT NOT NULL,
        end_time TEXT,
        total_posts INTEGER DEFAULT 0,
        synced_posts INTEGER DEFAULT 0,
        total_media INTEGER DEFAULT 0,
        synced_media INTEGER DEFAULT 0,
        errors TEXT, -- JSON string of error messages
        export_format TEXT NOT NULL,
        local_path TEXT,
        created_at TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create sync file details table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_file_details (
        id TEXT PRIMARY KEY,
        sync_operation_id TEXT NOT NULL,
        file_type TEXT NOT NULL CHECK (file_type IN ('post', 'media', 'export')),
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER DEFAULT 0,
        status TEXT NOT NULL CHECK (status IN ('pending', 'synced', 'failed', 'skipped')),
        error_message TEXT,
        synced_at TEXT,
        wordpress_id INTEGER,
        wordpress_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sync_operation_id) REFERENCES sync_operations(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_posts_site_id ON wordpress_posts(wordpress_site_id);
      CREATE INDEX IF NOT EXISTS idx_posts_synced_at ON wordpress_posts(synced_at);
      CREATE INDEX IF NOT EXISTS idx_posts_slug ON wordpress_posts(slug);
      CREATE INDEX IF NOT EXISTS idx_posts_status ON wordpress_posts(status);
      
      CREATE INDEX IF NOT EXISTS idx_media_site_id ON wordpress_media(wordpress_site_id);
      CREATE INDEX IF NOT EXISTS idx_media_synced_at ON wordpress_media(synced_at);
      CREATE INDEX IF NOT EXISTS idx_media_mime_type ON wordpress_media(mime_type);
      
      CREATE INDEX IF NOT EXISTS idx_sync_operations_site_id ON sync_operations(site_id);
      CREATE INDEX IF NOT EXISTS idx_sync_operations_status ON sync_operations(status);
      CREATE INDEX IF NOT EXISTS idx_sync_operations_start_time ON sync_operations(start_time);
      
      CREATE INDEX IF NOT EXISTS idx_sync_file_details_operation_id ON sync_file_details(sync_operation_id);
      CREATE INDEX IF NOT EXISTS idx_sync_file_details_file_type ON sync_file_details(file_type);
      CREATE INDEX IF NOT EXISTS idx_sync_file_details_status ON sync_file_details(status);
    `);

    // Create triggers for updated_at timestamps
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_posts_timestamp 
      AFTER UPDATE ON wordpress_posts
      BEGIN
        UPDATE wordpress_posts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_media_timestamp 
      AFTER UPDATE ON wordpress_media
      BEGIN
        UPDATE wordpress_media SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_sync_operations_timestamp 
      AFTER UPDATE ON sync_operations
      BEGIN
        UPDATE sync_operations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END
    `);
  }

  // ==================== POSTS OPERATIONS ====================

  /**
   * Save or update a WordPress post
   */
  savePost(post: WordPressPost): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO wordpress_posts 
      (id, title, content, excerpt, slug, status, type, author, featured_media, parent, 
       menu_order, comment_status, ping_status, template, format, meta, date, date_gmt, 
       modified, modified_gmt, link, guid, wordpress_site_id, synced_at, local_content, export_format)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      post.id,
      post.title,
      post.content,
      post.excerpt,
      post.slug,
      post.status,
      post.type,
      post.author,
      post.featured_media,
      post.parent,
      post.menu_order,
      post.comment_status,
      post.ping_status,
      post.template,
      post.format,
      post.meta,
      post.date,
      post.date_gmt,
      post.modified,
      post.modified_gmt,
      post.link,
      post.guid,
      post.wordpress_site_id,
      post.synced_at,
      post.local_content,
      post.export_format
    );
  }

  /**
   * Get posts by site ID
   */
  getPostsBySite(siteId: string, limit: number = 100, offset: number = 0): WordPressPost[] {
    const stmt = this.db.prepare(`
      SELECT * FROM wordpress_posts 
      WHERE wordpress_site_id = ? 
      ORDER BY synced_at DESC 
      LIMIT ? OFFSET ?
    `);

    return stmt.all(siteId, limit, offset) as WordPressPost[];
  }

  /**
   * Get a specific post by ID and site
   */
  getPost(postId: number, siteId: string): WordPressPost | null {
    const stmt = this.db.prepare(`
      SELECT * FROM wordpress_posts 
      WHERE id = ? AND wordpress_site_id = ?
    `);

    return stmt.get(postId, siteId) as WordPressPost || null;
  }

  /**
   * Delete posts by site ID
   */
  deletePostsBySite(siteId: string): number {
    const stmt = this.db.prepare(`
      DELETE FROM wordpress_posts WHERE wordpress_site_id = ?
    `);

    const result = stmt.run(siteId);
    return result.changes;
  }

  // ==================== MEDIA OPERATIONS ====================

  /**
   * Save or update WordPress media
   */
  saveMedia(media: WordPressMedia): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO wordpress_media 
      (id, title, description, caption, alt_text, source_url, mime_type, file_name, 
       file_size, width, height, wordpress_site_id, synced_at, local_path, local_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      media.id,
      media.title,
      media.description,
      media.caption,
      media.alt_text,
      media.source_url,
      media.mime_type,
      media.file_name,
      media.file_size,
      media.width,
      media.height,
      media.wordpress_site_id,
      media.synced_at,
      media.local_path,
      media.local_data
    );
  }

  /**
   * Get media by site ID
   */
  getMediaBySite(siteId: string, limit: number = 100, offset: number = 0): WordPressMedia[] {
    const stmt = this.db.prepare(`
      SELECT * FROM wordpress_media 
      WHERE wordpress_site_id = ? 
      ORDER BY synced_at DESC 
      LIMIT ? OFFSET ?
    `);

    return stmt.all(siteId, limit, offset) as WordPressMedia[];
  }

  /**
   * Get media by MIME type
   */
  getMediaByMimeType(siteId: string, mimeType: string): WordPressMedia[] {
    const stmt = this.db.prepare(`
      SELECT * FROM wordpress_media 
      WHERE wordpress_site_id = ? AND mime_type LIKE ?
      ORDER BY synced_at DESC
    `);

    return stmt.all(siteId, `${mimeType}%`) as WordPressMedia[];
  }

  /**
   * Delete media by site ID
   */
  deleteMediaBySite(siteId: string): number {
    const stmt = this.db.prepare(`
      DELETE FROM wordpress_media WHERE wordpress_site_id = ?
    `);

    const result = stmt.run(siteId);
    return result.changes;
  }

  // ==================== SYNC OPERATIONS ====================

  /**
   * Create a new sync operation
   */
  createSyncOperation(operation: Omit<SyncOperation, 'id' | 'created_at'>): string {
    const id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const createdAt = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO sync_operations 
      (id, site_id, site_name, operation_type, status, start_time, end_time, 
       total_posts, synced_posts, total_media, synced_media, errors, export_format, local_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      operation.site_id,
      operation.site_name,
      operation.operation_type,
      operation.status,
      operation.start_time,
      operation.end_time,
      operation.total_posts,
      operation.synced_posts,
      operation.total_media,
      operation.synced_media,
      operation.errors,
      operation.export_format,
      operation.local_path,
      createdAt
    );

    return id;
  }

  /**
   * Update sync operation status
   */
  updateSyncOperation(id: string, updates: Partial<SyncOperation>): void {
    const fields = Object.keys(updates).filter(key => key !== 'id' && key !== 'created_at');
    if (fields.length === 0) return;

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => (updates as any)[field]);

    const stmt = this.db.prepare(`
      UPDATE sync_operations 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);

    stmt.run(...values, id);
  }

  /**
   * Get sync operations by site ID
   */
  getSyncOperationsBySite(siteId: string, limit: number = 50): SyncOperation[] {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_operations 
      WHERE site_id = ? 
      ORDER BY start_time DESC 
      LIMIT ?
    `);

    return stmt.all(siteId, limit) as SyncOperation[];
  }

  /**
   * Get all sync operations
   */
  getAllSyncOperations(limit: number = 100): SyncOperation[] {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_operations 
      ORDER BY start_time DESC 
      LIMIT ?
    `);

    return stmt.all(limit) as SyncOperation[];
  }

  // ==================== SYNC FILE DETAILS ====================

  /**
   * Add sync file detail
   */
  addSyncFileDetail(detail: Omit<SyncFileDetail, 'id'>): string {
    const id = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const stmt = this.db.prepare(`
      INSERT INTO sync_file_details 
      (id, sync_operation_id, file_type, file_name, file_path, file_size, 
       status, error_message, synced_at, wordpress_id, wordpress_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      detail.sync_operation_id,
      detail.file_type,
      detail.file_name,
      detail.file_path,
      detail.file_size,
      detail.status,
      detail.error_message,
      detail.synced_at,
      detail.wordpress_id,
      detail.wordpress_url
    );

    return id;
  }

  /**
   * Update sync file detail status
   */
  updateSyncFileDetail(id: string, status: string, errorMessage?: string): void {
    const stmt = this.db.prepare(`
      UPDATE sync_file_details 
      SET status = ?, error_message = ?, synced_at = ?
      WHERE id = ?
    `);

    const syncedAt = status === 'synced' ? new Date().toISOString() : null;
    stmt.run(status, errorMessage, syncedAt, id);
  }

  /**
   * Get sync file details by operation ID
   */
  getSyncFileDetails(operationId: string): SyncFileDetail[] {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_file_details 
      WHERE sync_operation_id = ? 
      ORDER BY created_at ASC
    `);

    return stmt.all(operationId) as SyncFileDetail[];
  }

  // ==================== STATISTICS ====================

  /**
   * Get sync statistics for a site
   */
  getSyncStats(siteId: string): {
    totalPosts: number;
    totalMedia: number;
    totalSyncOperations: number;
    lastSyncTime: string | null;
    totalFileSize: number;
  } {
    const postsStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM wordpress_posts WHERE wordpress_site_id = ?
    `);
    const postsResult = postsStmt.get(siteId) as { count: number };

    const mediaStmt = this.db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as total_size 
      FROM wordpress_media WHERE wordpress_site_id = ?
    `);
    const mediaResult = mediaStmt.get(siteId) as { count: number; total_size: number };

    const syncStmt = this.db.prepare(`
      SELECT COUNT(*) as count, MAX(start_time) as last_sync 
      FROM sync_operations WHERE site_id = ?
    `);
    const syncResult = syncStmt.get(siteId) as { count: number; last_sync: string | null };

    return {
      totalPosts: postsResult.count,
      totalMedia: mediaResult.count,
      totalSyncOperations: syncResult.count,
      lastSyncTime: syncResult.last_sync,
      totalFileSize: mediaResult.total_size
    };
  }

  /**
   * Get database size in MB
   */
  getDatabaseSize(): number {
    const stats = fs.statSync(this.dbPath);
    return Math.round((stats.size / 1024 / 1024) * 100) / 100;
  }

  /**
   * Clean up old data (older than specified days)
   */
  cleanupOldData(daysToKeep: number = 90): {
    deletedPosts: number;
    deletedMedia: number;
    deletedSyncOperations: number;
  } {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffISO = cutoffDate.toISOString();

    // Delete old posts
    const postsStmt = this.db.prepare(`
      DELETE FROM wordpress_posts WHERE synced_at < ?
    `);
    const postsResult = postsStmt.run(cutoffISO);

    // Delete old media
    const mediaStmt = this.db.prepare(`
      DELETE FROM wordpress_media WHERE synced_at < ?
    `);
    const mediaResult = mediaStmt.run(cutoffISO);

    // Delete old sync operations
    const syncStmt = this.db.prepare(`
      DELETE FROM sync_operations WHERE start_time < ?
    `);
    const syncResult = syncStmt.run(cutoffISO);

    return {
      deletedPosts: postsResult.changes,
      deletedMedia: mediaResult.changes,
      deletedSyncOperations: syncResult.changes
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
