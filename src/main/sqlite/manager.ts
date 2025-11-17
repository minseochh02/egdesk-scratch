import { app, ipcMain } from 'electron';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { SQLiteTaskManager } from './tasks';
import { WordPressDatabaseManager } from './wordpress';
import { SQLiteScheduledPostsManager } from './scheduled-posts';
import {
  SQLiteBusinessIdentityManager,
  CreateBusinessIdentitySnapshot,
  CreateBusinessIdentitySnsPlan,
} from './business-identity';
import { initializeSQLiteDatabase, getDatabaseSize } from './init';
import { ScheduledPostsExecutor } from '../scheduler/scheduled-posts-executor';
import { restartScheduledPostsExecutor } from '../scheduler/executor-instance';

/**
 * Central SQLite Manager
 * 
 * This is the main entry point for all SQLite operations in the application.
 * It manages initialization, provides a unified API, and handles all database
 * operations for conversations, tasks, and WordPress data.
 */
export class SQLiteManager {
  private static instance: SQLiteManager | null = null;
  
  // Database connections
  private conversationsDb: Database.Database | null = null;
  private taskDb: Database.Database | null = null;
  private wordpressDb: Database.Database | null = null;
  
  // State management
  private isInitialized = false;
  private initializationError: string | null = null;
  
  // Managers
  private taskManager: SQLiteTaskManager | null = null;
  private wordpressManager: WordPressDatabaseManager | null = null;
  private scheduledPostsManager: SQLiteScheduledPostsManager | null = null;
  private businessIdentityManager: SQLiteBusinessIdentityManager | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance of SQLiteManager
   */
  public static getInstance(): SQLiteManager {
    if (!SQLiteManager.instance) {
      SQLiteManager.instance = new SQLiteManager();
    }
    return SQLiteManager.instance;
  }

  /**
   * Initialize SQLite database
   */
  public async initialize(): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await initializeSQLiteDatabase();
      
      if (!result.success) {
        this.initializationError = result.error || 'Unknown initialization error';
        return { success: false, error: this.initializationError };
      }

      // Set up the manager with the initialized databases
      this.conversationsDb = result.conversationsDatabase!;
      this.taskDb = result.taskDatabase!;
      this.wordpressDb = result.wordpressDatabase!;
      this.taskManager = result.taskManager!;
      this.wordpressManager = new WordPressDatabaseManager(this.wordpressDb);
      this.scheduledPostsManager = new SQLiteScheduledPostsManager(this.wordpressDb);
      this.businessIdentityManager = new SQLiteBusinessIdentityManager(this.wordpressDb);
      this.isInitialized = true;
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.initializationError = errorMessage;
      console.error('❌ Failed to initialize SQLite Manager:', errorMessage);
      
      return { 
        success: false, 
        error: `SQLite initialization failed: ${errorMessage}` 
      };
    }
  }

  /**
   * Check if SQLite is available and initialized
   */
  public isAvailable(): boolean {
    return this.isInitialized && this.conversationsDb !== null && this.taskDb !== null && this.wordpressDb !== null;
  }

  /**
   * Get initialization error if any
   */
  public getInitializationError(): string | null {
    return this.initializationError;
  }

  /**
   * Get database status information
   */
  public getStatus(): {
    isInitialized: boolean;
    hasConversationsDb: boolean;
    hasTaskDb: boolean;
    hasWordPressDb: boolean;
    error: string | null;
  } {
    return {
      isInitialized: this.isInitialized,
      hasConversationsDb: this.conversationsDb !== null,
      hasTaskDb: this.taskDb !== null,
      hasWordPressDb: this.wordpressDb !== null,
      error: this.initializationError
    };
  }

  /**
   * Get conversations database size in MB
   */
  public getConversationsDatabaseSize(): number {
    if (!this.conversationsDb) return 0;
    return getDatabaseSize(this.conversationsDb.name);
  }

  /**
   * Get task database size in MB
   */
  public getTaskDatabaseSize(): number {
    if (!this.taskDb) return 0;
    return getDatabaseSize(this.taskDb.name);
  }

  /**
   * Get WordPress database size in MB
   */
  public getWordPressDatabaseSize(): number {
    if (!this.wordpressDb) return 0;
    return getDatabaseSize(this.wordpressDb.name);
  }

  /**
   * Clean up database connections
   */
  public cleanup(): void {
    try {
      if (this.conversationsDb) {
        this.conversationsDb.close();
        this.conversationsDb = null;
      }
      
      if (this.taskDb) {
        this.taskDb.close();
        this.taskDb = null;
      }
      
      if (this.wordpressDb) {
        this.wordpressDb.close();
        this.wordpressDb = null;
      }
      
      this.isInitialized = false;
      this.initializationError = null;
      this.taskManager = null;
      this.wordpressManager = null;
      this.scheduledPostsManager = null;
      this.businessIdentityManager = null;
      
      console.log('🧹 SQLite Manager cleaned up');
    } catch (error) {
      console.error('❌ Error during SQLite cleanup:', error);
    }
  }

  /**
   * Ensure SQLite is initialized before operations
   */
  private ensureInitialized(): void {
    if (!this.isInitialized || !this.conversationsDb || !this.taskDb || !this.wordpressDb) {
      throw new Error(
        this.initializationError || 
        'SQLite Manager is not initialized. Please call initialize() first.'
      );
    }
  }

  /**
   * Get the conversations database instance (for internal use)
   */
  public getConversationsDatabase(): Database.Database {
    this.ensureInitialized();
    return this.conversationsDb!;
  }

  /**
   * Get the task database instance (for internal use)
   */
  public getTaskDatabase(): Database.Database {
    this.ensureInitialized();
    return this.taskDb!;
  }

  /**
   * Get the WordPress database instance (for internal use)
   */
  public getWordPressDatabase(): Database.Database {
    this.ensureInitialized();
    return this.wordpressDb!;
  }

  public getBusinessIdentityManager(): SQLiteBusinessIdentityManager {
    this.ensureInitialized();
    if (!this.businessIdentityManager) {
      this.businessIdentityManager = new SQLiteBusinessIdentityManager(this.wordpressDb!);
    }
    return this.businessIdentityManager;
  }

  /**
   * WordPress delegation methods
   */
  
  /**
   * Get posts by site ID
   */
  public getPostsBySite(siteId: string, limit: number = 100, offset: number = 0) {
    this.ensureInitialized();
    if (!this.wordpressManager) {
      throw new Error('WordPress manager not available');
    }
    return this.wordpressManager.getPostsBySite(siteId, limit, offset);
  }

  /**
   * Get a specific post by ID and site
   */
  public getPostById(postId: number, siteId: string) {
    this.ensureInitialized();
    if (!this.wordpressManager) {
      throw new Error('WordPress manager not available');
    }
    return this.wordpressManager.getPostById(postId, siteId);
  }

  /**
   * Save a WordPress post
   */
  public savePost(post: any) {
    this.ensureInitialized();
    if (!this.wordpressManager) {
      throw new Error('WordPress manager not available');
    }
    return this.wordpressManager.savePost(post);
  }

  /**
   * Get media by site ID
   */
  public getMediaBySite(siteId: string, limit: number = 100, offset: number = 0) {
    this.ensureInitialized();
    if (!this.wordpressManager) {
      throw new Error('WordPress manager not available');
    }
    return this.wordpressManager.getMediaBySite(siteId, limit, offset);
  }

  public saveComment(comment: any) {
    this.ensureInitialized();
    if (!this.wordpressManager) {
      throw new Error('WordPress manager not available');
    }
    return this.wordpressManager.saveComment(comment);
  }

  public getCommentsBySite(siteId: string, limit: number = 100, offset: number = 0) {
    this.ensureInitialized();
    if (!this.wordpressManager) {
      throw new Error('WordPress manager not available');
    }
    return this.wordpressManager.getCommentsBySite(siteId, limit, offset);
  }

  public getCommentsByPost(postId: number, siteId: string, limit: number = 100, offset: number = 0) {
    this.ensureInitialized();
    if (!this.wordpressManager) {
      throw new Error('WordPress manager not available');
    }
    return this.wordpressManager.getCommentsByPost(postId, siteId, limit, offset);
  }

  public getCommentById(commentId: number, siteId: string) {
    this.ensureInitialized();
    if (!this.wordpressManager) {
      throw new Error('WordPress manager not available');
    }
    return this.wordpressManager.getCommentById(commentId, siteId);
  }

  public updateCommentStatus(commentId: number, siteId: string, status: string) {
    this.ensureInitialized();
    if (!this.wordpressManager) {
      throw new Error('WordPress manager not available');
    }
    return this.wordpressManager.updateCommentStatus(commentId, siteId, status);
  }

  public deleteComment(commentId: number, siteId: string) {
    this.ensureInitialized();
    if (!this.wordpressManager) {
      throw new Error('WordPress manager not available');
    }
    return this.wordpressManager.deleteComment(commentId, siteId);
  }

  /**
   * Save WordPress media
   */
  public saveMedia(media: any) {
    this.ensureInitialized();
    if (!this.wordpressManager) {
      throw new Error('WordPress manager not available');
    }
    return this.wordpressManager.saveMedia(media);
  }

  /**
   * Create a sync operation
   */
  public createSyncOperation(operation: any) {
    this.ensureInitialized();
    if (!this.wordpressManager) {
      throw new Error('WordPress manager not available');
    }
    return this.wordpressManager.createSyncOperation(operation);
  }

  /**
   * Update a sync operation
   */
  public updateSyncOperation(operationId: number, updates: any) {
    this.ensureInitialized();
    if (!this.wordpressManager) {
      throw new Error('WordPress manager not available');
    }
    return this.wordpressManager.updateSyncOperation(operationId, updates);
  }

  /**
   * Get sync operations by site
   */
  public getSyncOperationsBySite(siteId: string, limit: number = 50) {
    this.ensureInitialized();
    if (!this.wordpressManager) {
      throw new Error('WordPress manager not available');
    }
    return this.wordpressManager.getSyncOperationsBySite(siteId, limit);
  }

  /**
   * Get sync statistics for a site
   */
  public getSyncStats(siteId: string) {
    this.ensureInitialized();
    if (!this.wordpressManager) {
      throw new Error('WordPress manager not available');
    }
    return this.wordpressManager.getSyncStats(siteId);
  }

  /**
   * Add sync file detail
   */
  public addSyncFileDetail(fileDetail: any) {
    this.ensureInitialized();
    if (!this.wordpressManager) {
      throw new Error('WordPress manager not available');
    }
    return this.wordpressManager.addSyncFileDetail(fileDetail);
  }

  /**
   * Update sync file detail
   */
  public updateSyncFileDetail(fileDetailId: number, status: string, errorMessage?: string) {
    this.ensureInitialized();
    if (!this.wordpressManager) {
      throw new Error('WordPress manager not available');
    }
    return this.wordpressManager.updateSyncFileDetail(fileDetailId, status, errorMessage);
  }

  /**
   * Get sync file details by operation ID
   */
  public getSyncFileDetails(operationId: number) {
    this.ensureInitialized();
    if (!this.wordpressManager) {
      throw new Error('WordPress manager not available');
    }
    return this.wordpressManager.getSyncFileDetails(operationId);
  }

  /**
   * Export data to files
   */
  public async exportToFiles(exportOptions: any) {
    this.ensureInitialized();
    if (!this.wordpressManager) {
      throw new Error('WordPress manager not available');
    }
    return this.wordpressManager.exportToFiles(exportOptions);
  }

  /**
   * Get the conversations database instance (for AI chat)
   */
  public getDatabase(): Database.Database {
    this.ensureInitialized();
    return this.conversationsDb!;
  }

  /**
   * Get the task manager instance
   */
  public getTaskManager(): SQLiteTaskManager {
    this.ensureInitialized();
    if (!this.taskManager) {
      throw new Error('Task manager not initialized');
    }
    return this.taskManager;
  }

  /**
   * Get the WordPress manager instance
   */
  public getWordPressManager(): WordPressDatabaseManager {
    this.ensureInitialized();
    if (!this.wordpressManager) {
      throw new Error('WordPress manager not initialized');
    }
    return this.wordpressManager;
  }

  /**
   * Get the scheduled posts manager instance
   */
  public getScheduledPostsManager(): SQLiteScheduledPostsManager {
    this.ensureInitialized();
    if (!this.scheduledPostsManager) {
      throw new Error('Scheduled posts manager not initialized');
    }
    return this.scheduledPostsManager;
  }

  /**
   * Get WordPress connections from store (fallback method)
   */
  public getWordPressConnections(): any[] {
    try {
      // Import the getStore function to access the global store instance
      const { getStore } = require('../storage');
      const store = getStore();
      return store.get('wordpressConnections', []);
    } catch (error) {
      console.error('Error getting WordPress connections:', error);
      return [];
    }
  }

  /**
   * Register all IPC handlers
   */
  public registerIPCHandlers(): void {
    this.registerStatusHandlers();
    this.registerTaskHandlers();
    this.registerWordPressHandlers();
    this.registerScheduledPostsHandlers();
    this.registerBusinessIdentityHandlers();
  }

  /**
   * Register status and utility handlers
   */
  private registerStatusHandlers(): void {
    // Get SQLite status
    ipcMain.handle('sqlite-get-status', async () => {
      try {
        return {
          success: true,
          status: this.getStatus()
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Check if SQLite is available
    ipcMain.handle('sqlite-is-available', async () => {
      try {
        return {
          success: true,
          available: this.isAvailable()
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get database sizes
    ipcMain.handle('sqlite-get-database-sizes', async () => {
      try {
        return {
          success: true,
          sizes: {
            conversations: this.getConversationsDatabaseSize(),
            tasks: this.getTaskDatabaseSize(),
            wordpress: this.getWordPressDatabaseSize()
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get database paths
    ipcMain.handle('sqlite-get-database-paths', async () => {
      try {
        const { getConversationsDatabasePath, getWordPressDatabasePath } = require('./init');
        const { getTaskDatabasePath } = require('./init');
        
        return {
          success: true,
          paths: {
            conversations: getConversationsDatabasePath(),
            tasks: getTaskDatabasePath(),
            wordpress: getWordPressDatabasePath()
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Migrate tasks from Electron Store to SQLite (testing utility)
    ipcMain.handle('sqlite-migrate-tasks-from-store', async () => {
      try {
        this.ensureInitialized();
        const { getStore } = require('../storage');
        const store = getStore();
        const scheduledTasks = store.get('scheduledTasks', []) as any[];
        const taskExecutions = store.get('taskExecutions', []) as any[];

        if (!this.taskManager) {
          throw new Error('Task manager not initialized');
        }

        let migratedTasks = 0;
        let migratedExecutions = 0;

        for (const legacyTask of scheduledTasks) {
          try {
            const taskId = legacyTask.id || legacyTask.taskId || legacyTask.uuid || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const now = new Date();
            const scheduledTask = {
              id: taskId,
              name: legacyTask.name || legacyTask.title || 'Legacy Task',
              description: legacyTask.description || undefined,
              command: legacyTask.command || legacyTask.script || 'blog:generate-and-upload',
              schedule: legacyTask.schedule || legacyTask.cron || 'custom',
              enabled: legacyTask.enabled !== false,
              aiKeyId: legacyTask.aiKeyId || legacyTask.ai_key_id || legacyTask.selectedKeyId || null,
              environment: legacyTask.environment || legacyTask.env || undefined,
              metadata: {
                ...(legacyTask.metadata || {}),
                source: 'electron-store',
                migratedAt: now.toISOString(),
              },
              createdAt: legacyTask.createdAt ? new Date(legacyTask.createdAt) : now,
              updatedAt: legacyTask.updatedAt ? new Date(legacyTask.updatedAt) : now,
              lastRun: legacyTask.lastRun ? new Date(legacyTask.lastRun) : undefined,
              nextRun: legacyTask.nextRun ? new Date(legacyTask.nextRun) : undefined,
              runCount: legacyTask.runCount || 0,
              successCount: legacyTask.successCount || 0,
              failureCount: legacyTask.failureCount || 0,
              frequencyDays: legacyTask.frequencyDays || legacyTask.frequency_days || 1,
              frequencyHours: legacyTask.frequencyHours || legacyTask.frequency_hours || 0,
              frequencyMinutes: legacyTask.frequencyMinutes || legacyTask.frequency_minutes || 0,
              topicSelectionMode: legacyTask.topicSelectionMode || legacyTask.topic_selection_mode || 'least-used',
            };

            // Upsert behavior: if task exists, update; else create
            const existing = this.taskManager.getTask(taskId);
            if (existing) {
              this.taskManager.updateTask(taskId, {
                ...scheduledTask,
                metadata: scheduledTask.metadata,
              } as any);
            } else {
              this.taskManager.createTask(scheduledTask as any);
              // mark legacy metadata
              try {
                this.taskDb!.prepare('UPDATE tasks SET legacy_id = ?, source = ? WHERE id = ?').run(legacyTask.id || null, 'electron-store', taskId);
              } catch {}
            }
            migratedTasks++;

            // Migrate related executions
            const relatedExecutions = (taskExecutions || []).filter((ex: any) => (ex.taskId || ex.task_id) === legacyTask.id);
            for (const ex of relatedExecutions) {
              const execId = ex.id || `${taskId}-${ex.startTime || ex.start_time || Date.now()}`;
              const execution = {
                id: execId,
                taskId,
                startTime: new Date(ex.startTime || ex.start_time || new Date().toISOString()),
                endTime: ex.endTime ? new Date(ex.endTime) : ex.end_time ? new Date(ex.end_time) : undefined,
                status: ex.status || (ex.error ? 'failed' : 'completed'),
                output: ex.output || undefined,
                exitCode: typeof ex.exitCode === 'number' ? ex.exitCode : undefined,
                error: ex.error || undefined,
                createdAt: ex.createdAt ? new Date(ex.createdAt) : new Date(),
              };

              const existingEx = this.taskManager.getExecution(execId);
              if (existingEx) {
                this.taskManager.updateExecution(execId, execution as any);
              } else {
                this.taskManager.createExecution(execution as any);
                try {
                  this.taskDb!.prepare('UPDATE task_executions SET legacy_id = ? WHERE id = ?').run(ex.id || null, execId);
                } catch {}
              }
              migratedExecutions++;
            }
          } catch (err) {
            console.warn('Task migration skipped due to error:', err);
          }
        }

        return {
          success: true,
          migratedTasks,
          migratedExecutions,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
  }

  /**
   * Register task-related handlers
   */
  private registerTaskHandlers(): void {
    if (!this.taskManager) {
      console.warn('⚠️ Task manager not available - skipping task handlers');
      return;
    }

    // Create task
    ipcMain.handle('sqlite-task-create', async (event, taskData) => {
      try {
        this.taskManager!.createTask(taskData);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get all tasks
    ipcMain.handle('sqlite-task-get-all', async () => {
      try {
        const tasks = this.taskManager!.getAllTasks();
        return { success: true, tasks };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get task by ID
    ipcMain.handle('sqlite-task-get-by-id', async (event, taskId) => {
      try {
        const task = this.taskManager!.getTask(taskId);
        return { success: true, task };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Update task
    ipcMain.handle('sqlite-task-update', async (event, taskId, updates) => {
      try {
        this.taskManager!.updateTask(taskId, updates);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Delete task
    ipcMain.handle('sqlite-task-delete', async (event, taskId) => {
      try {
        this.taskManager!.deleteTask(taskId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get task executions
    ipcMain.handle('sqlite-task-get-executions', async (event, taskId, limit = 50) => {
      try {
        const executions = this.taskManager!.getExecutions(taskId);
        return { success: true, executions };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get topics
    ipcMain.handle('sqlite-task-get-topics', async (event, taskId) => {
      try {
        const topics = this.taskManager!.getTopicsForTask(taskId);
        return { success: true, topics };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
  }

  /**
   * Register WordPress-related handlers
   */
  private registerWordPressHandlers(): void {
    if (!this.wordpressManager) {
      console.warn('⚠️ WordPress manager not available - skipping WordPress handlers');
      return;
    }

    // Save WordPress post
    ipcMain.handle('sqlite-wordpress-save-post', async (event, postData) => {
      try {
        this.wordpressManager!.savePost(postData);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get posts by site
    ipcMain.handle('sqlite-wordpress-get-posts', async (event, siteId, limit = 100, offset = 0) => {
      try {
        const posts = this.wordpressManager!.getPostsBySite(siteId, limit, offset);
        return { success: true, posts };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get post by ID
    ipcMain.handle('sqlite-wordpress-get-post', async (event, postId, siteId) => {
      try {
        const post = this.wordpressManager!.getPostById(postId, siteId);
        return { success: true, post };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Save WordPress media
    ipcMain.handle('sqlite-wordpress-save-media', async (event, mediaData) => {
      try {
        this.wordpressManager!.saveMedia(mediaData);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get media by site
    ipcMain.handle('sqlite-wordpress-get-media', async (event, siteId, limit = 100, offset = 0) => {
      try {
        const media = this.wordpressManager!.getMediaBySite(siteId, limit, offset);
        return { success: true, media };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Create sync operation
    ipcMain.handle('sqlite-wordpress-create-sync-operation', async (event, operationData) => {
      try {
        const operationId = this.wordpressManager!.createSyncOperation(operationData);
        return { success: true, operationId };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Update sync operation
    ipcMain.handle('sqlite-wordpress-update-sync-operation', async (event, operationId, updates) => {
      try {
        this.wordpressManager!.updateSyncOperation(operationId, updates);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get sync operations
    ipcMain.handle('sqlite-wordpress-get-sync-operations', async (event, siteId, limit = 50) => {
      try {
        const operations = this.wordpressManager!.getSyncOperationsBySite(siteId, limit);
        return { success: true, operations };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get sync stats
    ipcMain.handle('sqlite-wordpress-get-sync-stats', async (event, siteId) => {
      try {
        const stats = this.wordpressManager!.getSyncStats(siteId);
        return { success: true, stats };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Add sync file detail
    ipcMain.handle('sqlite-wordpress-add-file-detail', async (event, fileDetailData) => {
      try {
        const fileDetailId = this.wordpressManager!.addSyncFileDetail(fileDetailData);
        return { success: true, fileDetailId };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Update sync file detail
    ipcMain.handle('sqlite-wordpress-update-file-detail', async (event, fileDetailId, status, errorMessage) => {
      try {
        this.wordpressManager!.updateSyncFileDetail(fileDetailId, status, errorMessage);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get sync file details
    ipcMain.handle('sqlite-wordpress-get-file-details', async (event, operationId) => {
      try {
        const fileDetails = this.wordpressManager!.getSyncFileDetails(operationId);
        return { success: true, fileDetails };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Clear all WordPress data
    ipcMain.handle('sqlite-wordpress-clear-all', async () => {
      try {
        this.wordpressManager!.clearAllWordPressData();
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Clear WordPress data for specific site
    ipcMain.handle('sqlite-wordpress-clear-site', async (event, siteId) => {
      try {
        this.wordpressManager!.clearWordPressDataForSite(siteId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
  }

  /**
   * Register scheduled posts handlers
   */
  private registerScheduledPostsHandlers(): void {
    // Create scheduled post
    ipcMain.handle('sqlite-scheduled-posts-create', async (event, data) => {
      try {
        const scheduledPost = this.scheduledPostsManager!.createScheduledPost(data);
        await restartScheduledPostsExecutor();
        return { success: true, data: scheduledPost };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get scheduled post by ID
    ipcMain.handle('sqlite-scheduled-posts-get', async (event, id) => {
      try {
        const scheduledPost = this.scheduledPostsManager!.getScheduledPost(id);
        return { success: true, data: scheduledPost };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get scheduled posts by connection
    ipcMain.handle('sqlite-scheduled-posts-get-by-connection', async (event, connectionId) => {
      try {
        if (!this.scheduledPostsManager) {
          return { success: true, data: [] };
        }

        const scheduledPosts = this.scheduledPostsManager.getScheduledPostsByConnection(connectionId);
        return { success: true, data: scheduledPosts };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get all scheduled posts
    ipcMain.handle('sqlite-scheduled-posts-get-all', async (event) => {
      try {
        const scheduledPosts = this.scheduledPostsManager!.getAllScheduledPosts();
        return { success: true, data: scheduledPosts };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Update scheduled post
    ipcMain.handle('sqlite-scheduled-posts-update', async (event, id, updates) => {
      try {
        const scheduledPost = this.scheduledPostsManager!.updateScheduledPost(id, updates);
        // Restart scheduler to apply timing/enablement changes immediately
        await restartScheduledPostsExecutor();
        return { success: true, data: scheduledPost };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Delete scheduled post
    ipcMain.handle('sqlite-scheduled-posts-delete', async (event, id) => {
      try {
        const success = this.scheduledPostsManager!.deleteScheduledPost(id);
        await restartScheduledPostsExecutor();
        return { success };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Toggle scheduled post enabled/disabled
    ipcMain.handle('sqlite-scheduled-posts-toggle', async (event, id, enabled) => {
      try {
        const success = this.scheduledPostsManager!.toggleScheduledPost(id, enabled);
        await restartScheduledPostsExecutor();
        return { success };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get scheduled post topics
    ipcMain.handle('sqlite-scheduled-posts-get-topics', async (event, scheduledPostId) => {
      try {
        const topics = this.scheduledPostsManager!.getScheduledPostTopics(scheduledPostId);
        return { success: true, data: topics };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Run scheduled post immediately
    ipcMain.handle('sqlite-scheduled-posts-run-now', async (event, id) => {
      try {
        console.log(`\n🚀 ===== MANUAL SCHEDULED POST EXECUTION =====`);
        console.log(`🆔 Post ID: ${id}`);
        console.log(`🕐 Started at: ${new Date().toISOString()}`);
        
        // Get the scheduled post data
        const scheduledPost = this.scheduledPostsManager!.getScheduledPost(id);
        if (!scheduledPost) {
          console.error(`❌ Scheduled post not found: ${id}`);
          return {
            success: false,
            error: 'Scheduled post not found'
          };
        }

        console.log(`📝 Post: ${scheduledPost.title}`);
        console.log(`🔗 Connection: ${scheduledPost.connectionName}`);

        // Get the topics for this scheduled post
        const topics = this.scheduledPostsManager!.getScheduledPostTopics(id);
        const topicNames = topics.map(topic => topic.topicName);
        console.log(`📋 Topics: ${topicNames.join(', ')}`);

        // Create a new executor instance to run the post
        const executor = new ScheduledPostsExecutor();
        
        // Execute the scheduled post immediately
        // Note: The executor now handles all statistics updates internally
        await executor.executeScheduledPost({
          ...scheduledPost,
          topics: topicNames
        });

        console.log(`✅ Manual execution completed successfully`);
        return { success: true };
      } catch (error) {
        console.error(`\n💥 ===== MANUAL SCHEDULED POST EXECUTION FAILED =====`);
        console.error(`❌ Post ID: ${id}`);
        console.error(`🕐 Failed at: ${new Date().toISOString()}`);
        console.error(`📄 Error details:`, error);

        // Note: The executor handles failure statistics updates internally
        // No need to update stats here as it would be duplicate

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get execution history for a scheduled post
    ipcMain.handle('sqlite-scheduled-posts-get-execution-history', async (event, id) => {
      try {
        // For now, return mock data since we don't have execution history table yet
        // This would be implemented with a proper execution_history table
        const mockHistory = [
          {
            id: `exec_${Date.now()}_1`,
            scheduledPostId: id,
            status: 'success',
            startedAt: new Date(Date.now() - 86400000), // 1 day ago
            completedAt: new Date(Date.now() - 86400000 + 30000), // 30 seconds later
            duration: 30000,
            topics: ['Technology', 'AI', 'Programming'],
            generatedContent: {
              title: 'The Future of AI in Software Development',
              excerpt: 'Exploring how artificial intelligence is revolutionizing the way we write code...',
              wordCount: 1250,
              imageCount: 3
            },
            blogPostId: '12345',
            blogPostUrl: 'https://example.com/blog/the-future-of-ai'
          },
          {
            id: `exec_${Date.now()}_2`,
            scheduledPostId: id,
            status: 'failure',
            startedAt: new Date(Date.now() - 172800000), // 2 days ago
            completedAt: new Date(Date.now() - 172800000 + 15000), // 15 seconds later
            duration: 15000,
            topics: ['Web Development', 'React'],
            errorMessage: 'Failed to connect to WordPress API. Please check your connection settings.'
          }
        ];

        return { success: true, data: mockHistory };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
  }

  /**
   * Register business identity handlers
   */
  private registerBusinessIdentityHandlers(): void {
    ipcMain.handle('sqlite-business-identity-create-snapshot', async (event, data: CreateBusinessIdentitySnapshot) => {
      try {
        const snapshot = this.getBusinessIdentityManager().createSnapshot(data);
        return { success: true, data: snapshot };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    ipcMain.handle('sqlite-business-identity-get-snapshot', async (event, id: string) => {
      try {
        const snapshot = this.getBusinessIdentityManager().getSnapshot(id);
        return { success: true, data: snapshot };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    ipcMain.handle('sqlite-business-identity-list-snapshots', async (event, brandKey: string) => {
      try {
        const snapshots = this.getBusinessIdentityManager().listSnapshots(brandKey);
        return { success: true, data: snapshots };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    ipcMain.handle('sqlite-business-identity-update-analysis-results', async (event, snapshotId: string, seoAnalysis: any, sslAnalysis: any) => {
      try {
        this.getBusinessIdentityManager().updateAnalysisResults(snapshotId, seoAnalysis, sslAnalysis);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    ipcMain.handle(
      'sqlite-business-identity-save-sns-plans',
      async (
        event,
        payload: {
          snapshotId: string;
          plans: CreateBusinessIdentitySnsPlan[];
        }
      ) => {
        try {
          if (!payload?.snapshotId || !Array.isArray(payload.plans)) {
            throw new Error('Invalid SNS plan payload.');
          }
          const saved = this.getBusinessIdentityManager().replacePlans(payload.snapshotId, payload.plans);
          return { success: true, data: saved };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }
    );

    ipcMain.handle('sqlite-business-identity-list-sns-plans', async (event, snapshotId: string) => {
      try {
        if (!snapshotId) {
          throw new Error('Snapshot ID is required to list SNS plans.');
        }
        const plans = this.getBusinessIdentityManager().listPlans(snapshotId);
        return { success: true, data: plans };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
  }
}

// Export singleton instance getter
export const getSQLiteManager = (): SQLiteManager => SQLiteManager.getInstance();
