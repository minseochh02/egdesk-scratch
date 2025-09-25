import Database from 'better-sqlite3';
import { getWordPressDatabase } from './init';

/**
 * WordPress Database Manager
 * 
 * Handles all WordPress-related database operations including posts, media,
 * sync operations, and file details. This replaces the need for separate
 * WordPress SQLite manager files.
 */

export interface WordPressPost {
  id: number;
  title: string;
  content?: string;
  excerpt?: string;
  slug?: string;
  status?: string;
  type?: string;
  author?: number;
  featured_media?: number;
  parent?: number;
  menu_order?: number;
  comment_status?: string;
  ping_status?: string;
  template?: string;
  format?: string;
  meta?: string; // JSON string
  date?: string;
  date_gmt?: string;
  modified?: string;
  modified_gmt?: string;
  link?: string;
  guid?: string;
  wordpress_site_id: string;
  synced_at?: string;
  local_content?: string;
  export_format?: string;
}

export interface WordPressMedia {
  id: number;
  title?: string;
  description?: string;
  caption?: string;
  alt_text?: string;
  source_url: string;
  mime_type?: string;
  file_name?: string;
  file_size?: number;
  width?: number;
  height?: number;
  wordpress_site_id: string;
  synced_at?: string;
  local_data?: Buffer;
}

export interface SyncOperation {
  id?: number;
  site_id: string;
  site_name?: string;
  operation_type?: string;
  status?: string;
  start_time?: string;
  end_time?: string;
  total_posts?: number;
  synced_posts?: number;
  total_media?: number;
  synced_media?: number;
  errors?: string; // JSON string
  export_format?: string;
  local_path?: string;
  created_at?: string;
}

export interface SyncFileDetail {
  id?: number;
  sync_operation_id: number;
  file_type: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  status?: string;
  error_message?: string;
  synced_at?: string;
  wordpress_id?: string;
  wordpress_url?: string;
}

export class WordPressDatabaseManager {
  private db: Database.Database;

  constructor(database?: Database.Database) {
    this.db = database || getWordPressDatabase();
  }

  /**
   * Save a WordPress post to the database
   */
  savePost(post: WordPressPost): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO wordpress_posts (
        id, title, content, excerpt, slug, status, type, author,
        featured_media, parent, menu_order, comment_status, ping_status,
        template, format, meta, date, date_gmt, modified, modified_gmt,
        link, guid, wordpress_site_id, synced_at, local_content, export_format
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      post.id,
      post.title,
      post.content || null,
      post.excerpt || null,
      post.slug || null,
      post.status || 'publish',
      post.type || 'post',
      post.author || 1,
      post.featured_media || 0,
      post.parent || 0,
      post.menu_order || 0,
      post.comment_status || 'open',
      post.ping_status || 'open',
      post.template || '',
      post.format || 'standard',
      post.meta || null,
      post.date || null,
      post.date_gmt || null,
      post.modified || null,
      post.modified_gmt || null,
      post.link || null,
      post.guid || null,
      post.wordpress_site_id,
      post.synced_at || new Date().toISOString(),
      post.local_content || null,
      post.export_format || 'wordpress'
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
  getPostById(postId: number, siteId: string): WordPressPost | null {
    const stmt = this.db.prepare(`
      SELECT * FROM wordpress_posts 
      WHERE id = ? AND wordpress_site_id = ?
    `);

    return stmt.get(postId, siteId) as WordPressPost || null;
  }

  /**
   * Save WordPress media to the database
   */
  saveMedia(media: WordPressMedia): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO wordpress_media (
        id, title, description, caption, alt_text, source_url, mime_type,
        file_name, file_size, width, height, wordpress_site_id, synced_at, local_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      media.id,
      media.title || null,
      media.description || null,
      media.caption || null,
      media.alt_text || null,
      media.source_url,
      media.mime_type || 'image/jpeg',
      media.file_name || null,
      media.file_size || 0,
      media.width || 0,
      media.height || 0,
      media.wordpress_site_id,
      media.synced_at || new Date().toISOString(),
      media.local_data || null
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
   * Create a sync operation
   */
  createSyncOperation(operation: Omit<SyncOperation, 'id' | 'created_at'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO sync_operations (
        site_id, site_name, operation_type, status, start_time, end_time,
        total_posts, synced_posts, total_media, synced_media, errors,
        export_format, local_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      operation.site_id,
      operation.site_name || null,
      operation.operation_type || 'full_sync',
      operation.status || 'pending',
      operation.start_time || null,
      operation.end_time || null,
      operation.total_posts || 0,
      operation.synced_posts || 0,
      operation.total_media || 0,
      operation.synced_media || 0,
      operation.errors || null,
      operation.export_format || 'wordpress',
      operation.local_path || null
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Update a sync operation
   */
  updateSyncOperation(operationId: number, updates: Partial<SyncOperation>): void {
    const fields = Object.keys(updates).filter(key => key !== 'id' && key !== 'created_at');
    if (fields.length === 0) return;

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => updates[field as keyof SyncOperation]);

    const stmt = this.db.prepare(`
      UPDATE sync_operations 
      SET ${setClause} 
      WHERE id = ?
    `);

    stmt.run(...values, operationId);
  }

  /**
   * Get sync operations by site
   */
  getSyncOperationsBySite(siteId: string, limit: number = 50): SyncOperation[] {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_operations 
      WHERE site_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `);

    return stmt.all(siteId, limit) as SyncOperation[];
  }

  /**
   * Get sync statistics for a site
   */
  getSyncStats(siteId: string): {
    totalPosts: number;
    totalMedia: number;
    lastSync: string | null;
    pendingOperations: number;
  } {
    const postsStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM wordpress_posts WHERE wordpress_site_id = ?
    `);
    const mediaStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM wordpress_media WHERE wordpress_site_id = ?
    `);
    const lastSyncStmt = this.db.prepare(`
      SELECT MAX(synced_at) as last_sync FROM wordpress_posts WHERE wordpress_site_id = ?
    `);
    const pendingStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM sync_operations 
      WHERE site_id = ? AND status IN ('pending', 'running')
    `);

    const totalPosts = (postsStmt.get(siteId) as { count: number }).count;
    const totalMedia = (mediaStmt.get(siteId) as { count: number }).count;
    const lastSync = (lastSyncStmt.get(siteId) as { last_sync: string | null }).last_sync;
    const pendingOperations = (pendingStmt.get(siteId) as { count: number }).count;

    return {
      totalPosts,
      totalMedia,
      lastSync,
      pendingOperations
    };
  }

  /**
   * Add sync file detail
   */
  addSyncFileDetail(fileDetail: Omit<SyncFileDetail, 'id'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO sync_file_details (
        sync_operation_id, file_type, file_name, file_path, file_size,
        status, error_message, synced_at, wordpress_id, wordpress_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      fileDetail.sync_operation_id,
      fileDetail.file_type,
      fileDetail.file_name,
      fileDetail.file_path,
      fileDetail.file_size || 0,
      fileDetail.status || 'pending',
      fileDetail.error_message || null,
      fileDetail.synced_at || null,
      fileDetail.wordpress_id || null,
      fileDetail.wordpress_url || null
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Update sync file detail
   */
  updateSyncFileDetail(fileDetailId: number, status: string, errorMessage?: string): void {
    const stmt = this.db.prepare(`
      UPDATE sync_file_details 
      SET status = ?, error_message = ?, synced_at = ? 
      WHERE id = ?
    `);

    stmt.run(
      status,
      errorMessage || null,
      status === 'completed' ? new Date().toISOString() : null,
      fileDetailId
    );
  }

  /**
   * Get sync file details by operation ID
   */
  getSyncFileDetails(operationId: number): SyncFileDetail[] {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_file_details 
      WHERE sync_operation_id = ? 
      ORDER BY id ASC
    `);

    return stmt.all(operationId) as SyncFileDetail[];
  }

  /**
   * Export data to files (placeholder for future implementation)
   */
  async exportToFiles(exportOptions: any): Promise<{
    success: boolean;
    exportedFiles: string[];
    totalSize: number;
    error?: string;
  }> {
    // TODO: Implement file export functionality
    return {
      success: true,
      exportedFiles: [],
      totalSize: 0
    };
  }

  /**
   * Clean up database connection
   */
  cleanup(): void {
    if (this.db) {
      this.db.close();
    }
  }
}

// Export singleton instance getter
export const getWordPressDatabaseManager = (): WordPressDatabaseManager => {
  return new WordPressDatabaseManager();
};
