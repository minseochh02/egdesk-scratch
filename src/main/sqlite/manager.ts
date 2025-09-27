import { app, ipcMain } from 'electron';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { SQLiteTaskManager } from './tasks';
import { WordPressDatabaseManager } from './wordpress';
import { initializeSQLiteDatabase, getDatabaseSize } from './init';

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
   * Register all IPC handlers
   */
  public registerIPCHandlers(): void {
    this.registerStatusHandlers();
    this.registerTaskHandlers();
    this.registerWordPressHandlers();
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
}

// Export singleton instance getter
export const getSQLiteManager = (): SQLiteManager => SQLiteManager.getInstance();
