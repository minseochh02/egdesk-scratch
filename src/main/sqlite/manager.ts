import { app, ipcMain } from 'electron';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { SQLiteTaskManager } from './tasks';
import { WordPressDatabaseManager } from './wordpress';
import { SQLiteScheduledPostsManager } from './scheduled-posts';
import { SQLiteActivityManager } from './activity';
import {
  SQLiteBusinessIdentityManager,
  CreateBusinessIdentitySnapshot,
  CreateBusinessIdentitySnsPlan,
} from './business-identity';
import { SQLiteTemplateCopiesManager } from './template-copies';
import {
  SQLiteDockerSchedulerManager,
  CreateDockerTaskData,
} from './docker-scheduler';
import { SQLiteCompanyResearchManager } from './company-research';
import { restartDockerScheduler } from '../docker/docker-scheduler-instance';
import { getDockerSchedulerService } from '../docker/DockerSchedulerService';
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
  private activityDb: Database.Database | null = null;
  private cloudmcpDb: Database.Database | null = null;
  
  // State management
  private isInitialized = false;
  private initializationError: string | null = null;
  
  // Managers
  private taskManager: SQLiteTaskManager | null = null;
  private wordpressManager: WordPressDatabaseManager | null = null;
  private scheduledPostsManager: SQLiteScheduledPostsManager | null = null;
  private businessIdentityManager: SQLiteBusinessIdentityManager | null = null;
  private activityManager: SQLiteActivityManager | null = null;
  private templateCopiesManager: SQLiteTemplateCopiesManager | null = null;
  private dockerSchedulerManager: SQLiteDockerSchedulerManager | null = null;
  private companyResearchManager: SQLiteCompanyResearchManager | null = null;

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
      this.activityDb = result.activityDatabase!;
      this.cloudmcpDb = result.cloudmcpDatabase!;
      this.taskManager = result.taskManager!;
      this.wordpressManager = new WordPressDatabaseManager(this.wordpressDb);
      this.scheduledPostsManager = new SQLiteScheduledPostsManager(this.wordpressDb);
      this.businessIdentityManager = new SQLiteBusinessIdentityManager(this.wordpressDb);
      this.dockerSchedulerManager = new SQLiteDockerSchedulerManager(this.wordpressDb);
      this.activityManager = new SQLiteActivityManager(this.activityDb);
      this.templateCopiesManager = new SQLiteTemplateCopiesManager(this.cloudmcpDb);
      this.companyResearchManager = new SQLiteCompanyResearchManager(this.conversationsDb);
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
    return this.isInitialized && this.conversationsDb !== null && this.taskDb !== null && this.wordpressDb !== null && this.activityDb !== null && this.cloudmcpDb !== null;
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
    hasActivityDb: boolean;
    error: string | null;
  } {
    return {
      isInitialized: this.isInitialized,
      hasConversationsDb: this.conversationsDb !== null,
      hasTaskDb: this.taskDb !== null,
      hasWordPressDb: this.wordpressDb !== null,
      hasActivityDb: this.activityDb !== null,
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

      if (this.activityDb) {
        this.activityDb.close();
        this.activityDb = null;
      }
      
      this.isInitialized = false;
      this.initializationError = null;
      this.taskManager = null;
      this.wordpressManager = null;
      this.scheduledPostsManager = null;
      this.businessIdentityManager = null;
      this.activityManager = null;
      this.dockerSchedulerManager = null;
      
      console.log('🧹 SQLite Manager cleaned up');
    } catch (error) {
      console.error('❌ Error during SQLite cleanup:', error);
    }
  }

  /**
   * Ensure SQLite is initialized before operations
   */
  private ensureInitialized(): void {
    if (!this.isInitialized || !this.conversationsDb || !this.taskDb || !this.wordpressDb || !this.activityDb) {
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

  public getActivityDatabase(): Database.Database {
    this.ensureInitialized();
    return this.activityDb!;
  }

  public getActivityManager(): SQLiteActivityManager {
    this.ensureInitialized();
    if (!this.activityManager) {
      this.activityManager = new SQLiteActivityManager(this.activityDb!);
    }
    return this.activityManager;
  }

  public getTemplateCopiesManager(): SQLiteTemplateCopiesManager {
    this.ensureInitialized();
    if (!this.templateCopiesManager) {
      this.templateCopiesManager = new SQLiteTemplateCopiesManager(this.cloudmcpDb!);
    }
    return this.templateCopiesManager;
  }

  public getDockerSchedulerManager(): SQLiteDockerSchedulerManager {
    this.ensureInitialized();
    if (!this.dockerSchedulerManager) {
      this.dockerSchedulerManager = new SQLiteDockerSchedulerManager(this.wordpressDb!);
    }
    return this.dockerSchedulerManager;
  }

  public getCompanyResearchManager(): SQLiteCompanyResearchManager {
    this.ensureInitialized();
    if (!this.companyResearchManager) {
      this.companyResearchManager = new SQLiteCompanyResearchManager(this.conversationsDb!);
    }
    return this.companyResearchManager;
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
    this.registerActivityHandlers();
    this.registerTemplateCopiesHandlers();
    this.registerDockerSchedulerHandlers();
    this.registerCompanyResearchHandlers();
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
        if (!id) {
          return {
            success: false,
            error: 'Scheduled post ID is required'
          };
        }

        const history = this.getScheduledPostsManager().getExecutionHistory(id);
        return { success: true, data: history };
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

    ipcMain.handle('sqlite-business-identity-update-sns-plan-connection', async (event, planId: string, connectionId: string | null, connectionName: string | null, connectionType: string | null) => {
      try {
        this.getBusinessIdentityManager().updatePlanConnection(planId, connectionId, connectionName, connectionType);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    ipcMain.handle('sqlite-business-identity-update-sns-plan-ai-key', async (event, planId: string, aiKeyId: string | null) => {
      try {
        this.getBusinessIdentityManager().updatePlanAIKey(planId, aiKeyId);
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

    // Get execution history for an SNS plan
    ipcMain.handle('sqlite-business-identity-list-sns-plan-executions', async (event, planId: string) => {
      try {
        if (!planId) {
          return {
            success: false,
            error: 'Plan ID is required to list executions'
          };
        }
        const executions = this.getBusinessIdentityManager().listExecutions(planId);
        return { success: true, data: executions };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
  }

  /**
   * Register activity log handlers
   */
  private registerActivityHandlers(): void {
    // Create activity log
    ipcMain.handle('sqlite-activity-create', async (event, logData) => {
      try {
        const log = this.getActivityManager().createActivity(logData);
        return { success: true, data: log };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get recent activities
    ipcMain.handle('sqlite-activity-get-recent', async (event, limit, offset, filters) => {
      try {
        const logs = this.getActivityManager().getRecentActivities(limit, offset, filters);
        return { success: true, data: logs };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
  }

  /**
   * Register template copies IPC handlers
   */
  private registerTemplateCopiesHandlers(): void {
    // Create template copy
    ipcMain.handle('sqlite-template-copies-create', async (event, copyData) => {
      try {
        const copy = this.getTemplateCopiesManager().createTemplateCopy(copyData);
        return { success: true, data: copy };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get template copy by ID
    ipcMain.handle('sqlite-template-copies-get', async (event, id) => {
      try {
        const copy = this.getTemplateCopiesManager().getTemplateCopy(id);
        if (!copy) {
          return { success: false, error: 'Template copy not found' };
        }
        return { success: true, data: copy };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get template copies by template ID
    ipcMain.handle('sqlite-template-copies-get-by-template', async (event, templateId) => {
      try {
        const copies = this.getTemplateCopiesManager().getTemplateCopiesByTemplateId(templateId);
        return { success: true, data: copies };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get all template copies
    ipcMain.handle('sqlite-template-copies-get-all', async (event, limit, offset) => {
      try {
        const copies = this.getTemplateCopiesManager().getAllTemplateCopies(limit || 100, offset || 0);
        return { success: true, data: copies };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Delete template copy
    ipcMain.handle('sqlite-template-copies-delete', async (event, id) => {
      try {
        const deleted = this.getTemplateCopiesManager().deleteTemplateCopy(id);
        return { success: deleted, data: { deleted } };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get template copy by script ID
    ipcMain.handle('sqlite-template-copies-get-by-script-id', async (event, scriptId) => {
      try {
        const copy = this.getTemplateCopiesManager().getTemplateCopyByScriptId(scriptId);
        if (!copy) {
          return { success: false, error: 'Template copy not found for script ID' };
        }
        return { success: true, data: copy };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Update template copy script content
    ipcMain.handle('sqlite-template-copies-update-script-content', async (event, scriptId, scriptContent) => {
      try {
        const updated = this.getTemplateCopiesManager().updateTemplateCopyScriptContent(scriptId, scriptContent);
        return { success: updated, data: { updated } };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
  }

  /**
   * Register Docker scheduler IPC handlers
   */
  private registerDockerSchedulerHandlers(): void {
    // Get all Docker scheduled tasks
    ipcMain.handle('sqlite-docker-scheduler-get-all', async () => {
      try {
        const tasks = this.getDockerSchedulerManager().getAllTasks();
        return { success: true, data: tasks };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get Docker scheduled task by ID
    ipcMain.handle('sqlite-docker-scheduler-get', async (event, id: string) => {
      try {
        const task = this.getDockerSchedulerManager().getTask(id);
        return { success: true, data: task };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Create Docker scheduled task
    ipcMain.handle('sqlite-docker-scheduler-create', async (event, data: CreateDockerTaskData) => {
      try {
        const task = this.getDockerSchedulerManager().createTask(data);
        // Restart scheduler to pick up new task
        await restartDockerScheduler();
        return { success: true, data: task };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Update Docker scheduled task
    ipcMain.handle('sqlite-docker-scheduler-update', async (event, id: string, updates: Partial<CreateDockerTaskData>) => {
      try {
        const task = this.getDockerSchedulerManager().updateTask(id, updates);
        // Restart scheduler to apply changes
        await restartDockerScheduler();
        return { success: true, data: task };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Delete Docker scheduled task
    ipcMain.handle('sqlite-docker-scheduler-delete', async (event, id: string) => {
      try {
        const success = this.getDockerSchedulerManager().deleteTask(id);
        // Restart scheduler to remove deleted task
        await restartDockerScheduler();
        return { success };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Toggle Docker scheduled task enabled/disabled
    ipcMain.handle('sqlite-docker-scheduler-toggle', async (event, id: string, enabled: boolean) => {
      try {
        const success = this.getDockerSchedulerManager().toggleTask(id, enabled);
        // Restart scheduler to apply enable/disable
        await restartDockerScheduler();
        return { success };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get enabled Docker scheduled tasks
    ipcMain.handle('sqlite-docker-scheduler-get-enabled', async () => {
      try {
        const tasks = this.getDockerSchedulerManager().getEnabledTasks();
        return { success: true, data: tasks };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get execution history for a Docker task
    ipcMain.handle('sqlite-docker-scheduler-get-executions', async (event, taskId: string, limit?: number) => {
      try {
        const executions = this.getDockerSchedulerManager().getTaskExecutions(taskId, limit);
        return { success: true, data: executions };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get recent executions across all Docker tasks
    ipcMain.handle('sqlite-docker-scheduler-get-recent-executions', async (event, limit?: number) => {
      try {
        const executions = this.getDockerSchedulerManager().getRecentExecutions(limit);
        return { success: true, data: executions };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Run a Docker task immediately
    ipcMain.handle('sqlite-docker-scheduler-run-now', async (event, taskId: string) => {
      try {
        console.log(`\n🚀 ===== MANUAL DOCKER TASK EXECUTION =====`);
        console.log(`🆔 Task ID: ${taskId}`);
        console.log(`🕐 Started at: ${new Date().toISOString()}`);

        const task = this.getDockerSchedulerManager().getTask(taskId);
        if (!task) {
          return { success: false, error: 'Task not found' };
        }

        console.log(`📝 Task: ${task.name}`);
        console.log(`🔧 Type: ${task.taskType}`);

        // Get the scheduler service and execute the task
        const schedulerService = getDockerSchedulerService();
        if (!schedulerService) {
          return { success: false, error: 'Docker scheduler service not initialized' };
        }

        const result = await schedulerService.executeTask(taskId);
        
        if (result.success) {
          console.log(`✅ Manual execution completed successfully`);
        } else {
          console.error(`❌ Manual execution failed: ${result.error}`);
        }

        return result;
      } catch (error) {
        console.error(`\n💥 ===== MANUAL DOCKER TASK EXECUTION FAILED =====`);
        console.error(`❌ Task ID: ${taskId}`);
        console.error(`🕐 Failed at: ${new Date().toISOString()}`);
        console.error(`📄 Error details:`, error);

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get scheduler status
    ipcMain.handle('sqlite-docker-scheduler-status', async () => {
      try {
        const schedulerService = getDockerSchedulerService();
        return {
          success: true,
          data: {
            isRunning: schedulerService?.isServiceRunning() || false,
            scheduledJobCount: schedulerService?.getScheduledJobCount() || 0,
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Restart the scheduler
    ipcMain.handle('sqlite-docker-scheduler-restart', async () => {
      try {
        await restartDockerScheduler();
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
   * Register Company Research IPC handlers
   */
  private registerCompanyResearchHandlers(): void {
    ipcMain.handle('company-research-db-save', async (event, record) => {
      try {
        const saved = this.getCompanyResearchManager().saveResearch(record);
        return { success: true, data: saved };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    ipcMain.handle('company-research-db-get-all', async () => {
      try {
        // Use minimal data to avoid loading massive crawl_data fields
        const all = this.getCompanyResearchManager().getAllResearchMinimal();
        return { success: true, data: all };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    ipcMain.handle('company-research-db-get-by-id', async (event, id) => {
      try {
        const record = this.getCompanyResearchManager().getResearchById(id);
        return { success: true, data: record };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    ipcMain.handle('company-research-db-delete', async (event, id) => {
      try {
        const success = this.getCompanyResearchManager().deleteResearch(id);
        return { success };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    ipcMain.handle('company-research-db-find-by-domain', async (event, domain) => {
      try {
        const records = this.getCompanyResearchManager().findByDomain(domain);
        return { success: true, data: records };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    ipcMain.handle('company-research-db-update', async (event, id, updates) => {
      try {
        const updated = this.getCompanyResearchManager().updateResearch(id, updates);
        return { success: true, data: updated };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    ipcMain.handle('company-research-db-has-recent', async (event, domain, hoursAgo = 24) => {
      try {
        const hasRecent = this.getCompanyResearchManager().hasRecentResearch(domain, hoursAgo);
        return { success: true, data: hasRecent };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    ipcMain.handle('company-research-db-get-latest-completed', async (event, domain) => {
      try {
        const latest = this.getCompanyResearchManager().getLatestCompletedResearch(domain);
        return { success: true, data: latest };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
  }
}

// Export singleton instance getter
export const getSQLiteManager = (): SQLiteManager => SQLiteManager.getInstance();
