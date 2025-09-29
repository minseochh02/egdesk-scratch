import Database from 'better-sqlite3';

export interface ScheduledPost {
  id: string;
  title: string;
  connectionId: string;
  connectionName: string;
  connectionType: string;
  scheduledTime: string; // HH:MM format
  frequencyType: 'daily' | 'weekly' | 'monthly' | 'custom';
  frequencyValue: number;
  weeklyDay?: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  monthlyDay?: number; // 1-31
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  successCount: number;
  failureCount: number;
}

export interface ScheduledPostTopic {
  id: string;
  scheduledPostId: string;
  topicName: string;
  createdAt: Date;
}

export interface CreateScheduledPostData {
  title: string;
  connectionId: string;
  connectionName: string;
  connectionType: string;
  scheduledTime: string;
  frequencyType: 'daily' | 'weekly' | 'monthly' | 'custom';
  frequencyValue: number;
  weeklyDay?: number;
  monthlyDay?: number;
  topics: string[];
}

/**
 * SQLite Scheduled Posts Manager
 * 
 * Handles all scheduled post storage operations using SQLite.
 */
export class SQLiteScheduledPostsManager {
  private db: Database.Database;

  constructor(database: Database.Database) {
    this.db = database;
  }

  /**
   * Create a new scheduled post
   */
  createScheduledPost(data: CreateScheduledPostData): ScheduledPost {
    const id = this.generateId();
    const now = new Date();
    
    // Insert scheduled post
    const stmt = this.db.prepare(`
      INSERT INTO scheduled_posts (
        id, title, connection_id, connection_name, connection_type,
        scheduled_time, frequency_type, frequency_value, weekly_day, monthly_day,
        enabled, created_at, updated_at, run_count, success_count, failure_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.title,
      data.connectionId,
      data.connectionName,
      data.connectionType,
      data.scheduledTime,
      data.frequencyType,
      data.frequencyValue,
      data.weeklyDay || null,
      data.monthlyDay || null,
      1, // enabled
      now.toISOString(),
      now.toISOString(),
      0, // run_count
      0, // success_count
      0  // failure_count
    );

    // Insert topics
    if (data.topics.length > 0) {
      const topicStmt = this.db.prepare(`
        INSERT INTO scheduled_post_topics (id, scheduled_post_id, topic_name, created_at)
        VALUES (?, ?, ?, ?)
      `);

      data.topics.forEach(topicName => {
        topicStmt.run(
          this.generateId(),
          id,
          topicName,
          now.toISOString()
        );
      });
    }

    // Return the created scheduled post
    return this.getScheduledPost(id)!;
  }

  /**
   * Get a scheduled post by ID
   */
  getScheduledPost(id: string): ScheduledPost | null {
    const stmt = this.db.prepare(`
      SELECT * FROM scheduled_posts WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToScheduledPost(row);
  }

  /**
   * Get all scheduled posts for a connection
   */
  getScheduledPostsByConnection(connectionId: string): ScheduledPost[] {
    const stmt = this.db.prepare(`
      SELECT * FROM scheduled_posts 
      WHERE connection_id = ? 
      ORDER BY created_at DESC
    `);

    const rows = stmt.all(connectionId) as any[];
    return rows.map(row => this.mapRowToScheduledPost(row));
  }

  /**
   * Get all scheduled posts
   */
  getAllScheduledPosts(): ScheduledPost[] {
    const stmt = this.db.prepare(`
      SELECT * FROM scheduled_posts 
      ORDER BY created_at DESC
    `);

    const rows = stmt.all() as any[];
    return rows.map(row => this.mapRowToScheduledPost(row));
  }

  /**
   * Get topics for a scheduled post
   */
  getScheduledPostTopics(scheduledPostId: string): ScheduledPostTopic[] {
    const stmt = this.db.prepare(`
      SELECT * FROM scheduled_post_topics 
      WHERE scheduled_post_id = ? 
      ORDER BY created_at ASC
    `);

    const rows = stmt.all(scheduledPostId) as any[];
    return rows.map(row => ({
      id: row.id,
      scheduledPostId: row.scheduled_post_id,
      topicName: row.topic_name,
      createdAt: new Date(row.created_at)
    }));
  }

  /**
   * Update a scheduled post
   */
  updateScheduledPost(id: string, updates: Partial<CreateScheduledPostData>): ScheduledPost | null {
    const existing = this.getScheduledPost(id);
    if (!existing) return null;

    const now = new Date();
    
    // Update scheduled post
    const stmt = this.db.prepare(`
      UPDATE scheduled_posts 
      SET title = ?, scheduled_time = ?, frequency_type = ?, frequency_value = ?, 
          weekly_day = ?, monthly_day = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      updates.title || existing.title,
      updates.scheduledTime || existing.scheduledTime,
      updates.frequencyType || existing.frequencyType,
      updates.frequencyValue || existing.frequencyValue,
      updates.weeklyDay !== undefined ? updates.weeklyDay : existing.weeklyDay,
      updates.monthlyDay !== undefined ? updates.monthlyDay : existing.monthlyDay,
      now.toISOString(),
      id
    );

    // Update topics if provided
    if (updates.topics) {
      // Delete existing topics
      const deleteStmt = this.db.prepare(`
        DELETE FROM scheduled_post_topics WHERE scheduled_post_id = ?
      `);
      deleteStmt.run(id);

      // Insert new topics
      if (updates.topics.length > 0) {
        const topicStmt = this.db.prepare(`
          INSERT INTO scheduled_post_topics (id, scheduled_post_id, topic_name, created_at)
          VALUES (?, ?, ?, ?)
        `);

        updates.topics.forEach(topicName => {
          topicStmt.run(
            this.generateId(),
            id,
            topicName,
            now.toISOString()
          );
        });
      }
    }

    return this.getScheduledPost(id);
  }

  /**
   * Delete a scheduled post
   */
  deleteScheduledPost(id: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM scheduled_posts WHERE id = ?
    `);

    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Enable/disable a scheduled post
   */
  toggleScheduledPost(id: string, enabled: boolean): boolean {
    const stmt = this.db.prepare(`
      UPDATE scheduled_posts 
      SET enabled = ?, updated_at = ?
      WHERE id = ?
    `);

    const result = stmt.run(enabled ? 1 : 0, new Date().toISOString(), id);
    return result.changes > 0;
  }

  /**
   * Get scheduled posts that are due to run
   */
  getDueScheduledPosts(): ScheduledPost[] {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      SELECT * FROM scheduled_posts 
      WHERE enabled = 1 AND (next_run IS NULL OR next_run <= ?)
      ORDER BY next_run ASC
    `);

    const rows = stmt.all(now) as any[];
    return rows.map(row => this.mapRowToScheduledPost(row));
  }

  /**
   * Update run statistics for a scheduled post
   */
  updateRunStats(id: string, success: boolean): boolean {
    const stmt = this.db.prepare(`
      UPDATE scheduled_posts 
      SET run_count = run_count + 1,
          success_count = success_count + ?,
          failure_count = failure_count + ?,
          last_run = ?,
          updated_at = ?
      WHERE id = ?
    `);

    const now = new Date().toISOString();
    const result = stmt.run(
      success ? 1 : 0,
      success ? 0 : 1,
      now,
      now,
      id
    );

    return result.changes > 0;
  }

  /**
   * Calculate and update next run time for a scheduled post
   */
  updateNextRun(id: string): boolean {
    const post = this.getScheduledPost(id);
    if (!post) return false;

    const nextRun = this.calculateNextRun(post);
    if (!nextRun) return false;

    const stmt = this.db.prepare(`
      UPDATE scheduled_posts 
      SET next_run = ?, updated_at = ?
      WHERE id = ?
    `);

    const result = stmt.run(nextRun.toISOString(), new Date().toISOString(), id);
    return result.changes > 0;
  }

  /**
   * Calculate next run time based on frequency settings
   */
  private calculateNextRun(post: ScheduledPost): Date | null {
    const now = new Date();
    const [hours, minutes] = post.scheduledTime.split(':').map(Number);
    
    let nextRun = new Date();
    nextRun.setHours(hours, minutes, 0, 0);

    switch (post.frequencyType) {
      case 'daily':
        // If time has passed today, schedule for tomorrow
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        break;

      case 'weekly':
        if (post.weeklyDay !== undefined) {
          const daysUntilTarget = (post.weeklyDay - now.getDay() + 7) % 7;
          nextRun.setDate(now.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget));
        }
        break;

      case 'monthly':
        if (post.monthlyDay !== undefined) {
          nextRun.setDate(post.monthlyDay);
          nextRun.setMonth(now.getMonth());
          // If day has passed this month, schedule for next month
          if (nextRun <= now) {
            nextRun.setMonth(nextRun.getMonth() + 1);
          }
        }
        break;

      case 'custom':
        nextRun.setDate(now.getDate() + post.frequencyValue);
        break;

      default:
        return null;
    }

    return nextRun;
  }

  /**
   * Map database row to ScheduledPost object
   */
  private mapRowToScheduledPost(row: any): ScheduledPost {
    return {
      id: row.id,
      title: row.title,
      connectionId: row.connection_id,
      connectionName: row.connection_name,
      connectionType: row.connection_type,
      scheduledTime: row.scheduled_time,
      frequencyType: row.frequency_type,
      frequencyValue: row.frequency_value,
      weeklyDay: row.weekly_day,
      monthlyDay: row.monthly_day,
      enabled: Boolean(row.enabled),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastRun: row.last_run ? new Date(row.last_run) : undefined,
      nextRun: row.next_run ? new Date(row.next_run) : undefined,
      runCount: row.run_count,
      successCount: row.success_count,
      failureCount: row.failure_count
    };
  }

  /**
   * Update scheduled post statistics after execution
   */
  updateScheduledPostStats(id: string, success: boolean): void {
    try {
      const now = new Date().toISOString();
      
      if (success) {
        // Update success count and last run time
        const updateStmt = this.db.prepare(`
          UPDATE scheduled_posts 
          SET run_count = run_count + 1,
              success_count = success_count + 1,
              last_run = ?,
              updated_at = ?
          WHERE id = ?
        `);
        
        updateStmt.run(now, now, id);
      } else {
        // Update failure count and last run time
        const updateStmt = this.db.prepare(`
          UPDATE scheduled_posts 
          SET run_count = run_count + 1,
              failure_count = failure_count + 1,
              last_run = ?,
              updated_at = ?
          WHERE id = ?
        `);
        
        updateStmt.run(now, now, id);
      }
    } catch (error) {
      console.error('Failed to update scheduled post stats:', error);
      throw error;
    }
  }

  /**
   * Update next run time for a scheduled post
   */
  updateScheduledPostNextRun(id: string, nextRun: Date): void {
    try {
      const now = new Date().toISOString();
      const nextRunStr = nextRun.toISOString();
      
      const updateStmt = this.db.prepare(`
        UPDATE scheduled_posts 
        SET next_run = ?,
            updated_at = ?
        WHERE id = ?
      `);
      
      updateStmt.run(nextRunStr, now, id);
      console.log(`Updated next run time for post ${id}: ${nextRunStr}`);
    } catch (error) {
      console.error('Failed to update scheduled post next run time:', error);
      throw error;
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `scheduled_post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
