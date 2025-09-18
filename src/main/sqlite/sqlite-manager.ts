import { app, ipcMain } from 'electron';
import { WordPressSQLiteManager, WordPressPost, WordPressMedia, SyncOperation, SyncFileDetail, SyncStats } from './wordpress-sqlite-manager';
import { WordPressExportUtils, ExportOptions } from './wordpress-export-utils';

/**
 * Central SQLite Manager
 * 
 * This is the main entry point for all SQLite operations in the application.
 * It manages initialization, provides a unified API, and handles all database
 * operations through specialized managers.
 */
export class SQLiteManager {
  private static instance: SQLiteManager | null = null;
  
  // Specialized managers
  private wordpressManager: WordPressSQLiteManager | null = null;
  private exportUtils: WordPressExportUtils | null = null;
  
  // State management
  private isInitialized = false;
  private initializationError: string | null = null;

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
   * Initialize all SQLite components
   */
  public async initialize(schedulerManager?: any): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔧 Initializing SQLite Manager...');
      
      // Initialize WordPress manager
      this.wordpressManager = new WordPressSQLiteManager();
      console.log('✅ WordPress SQLite Manager initialized');
      
      // Initialize export utils with dependency injection
      this.exportUtils = new WordPressExportUtils(this.wordpressManager);
      console.log('✅ WordPress Export Utils initialized');
      
      this.isInitialized = true;
      console.log('🎉 SQLite Manager fully initialized');
      
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
    return this.isInitialized && this.wordpressManager !== null;
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
    hasWordPressManager: boolean;
    hasExportUtils: boolean;
    error: string | null;
  } {
    return {
      isInitialized: this.isInitialized,
      hasWordPressManager: this.wordpressManager !== null,
      hasExportUtils: this.exportUtils !== null,
      error: this.initializationError
    };
  }

  // ===========================================
  // WORDPRESS OPERATIONS
  // ===========================================

  /**
   * WordPress Posts Operations
   */
  public savePost(post: WordPressPost): void {
    this.ensureInitialized();
    this.wordpressManager!.savePost(post);
  }

  public getPostsBySite(siteId: string, limit: number = 100, offset: number = 0): WordPressPost[] {
    this.ensureInitialized();
    return this.wordpressManager!.getPostsBySite(siteId, limit, offset);
  }

  // Note: Individual post operations can be added to WordPressSQLiteManager if needed

  /**
   * WordPress Media Operations
   */
  public saveMedia(media: WordPressMedia): void {
    this.ensureInitialized();
    this.wordpressManager!.saveMedia(media);
  }

  public getMediaBySite(siteId: string, limit: number = 100, offset: number = 0): WordPressMedia[] {
    this.ensureInitialized();
    return this.wordpressManager!.getMediaBySite(siteId, limit, offset);
  }

  // Note: Individual media operations can be added to WordPressSQLiteManager if needed

  /**
   * Sync Operations
   */
  public createSyncOperation(operation: Omit<SyncOperation, 'id' | 'created_at'>): string {
    this.ensureInitialized();
    return this.wordpressManager!.createSyncOperation(operation);
  }

  public updateSyncOperation(operationId: string, updates: Partial<SyncOperation>): void {
    this.ensureInitialized();
    this.wordpressManager!.updateSyncOperation(operationId, updates);
  }

  public getSyncOperationsBySite(siteId: string, limit: number = 50): SyncOperation[] {
    this.ensureInitialized();
    return this.wordpressManager!.getSyncOperationsBySite(siteId, limit);
  }

  // Note: Individual sync operation management can be added if needed

  /**
   * Sync File Details
   */
  public addSyncFileDetail(fileDetail: Omit<SyncFileDetail, 'id'>): string {
    this.ensureInitialized();
    return this.wordpressManager!.addSyncFileDetail(fileDetail);
  }

  public updateSyncFileDetail(fileDetailId: string, status: string, errorMessage?: string): void {
    this.ensureInitialized();
    this.wordpressManager!.updateSyncFileDetail(fileDetailId, status, errorMessage);
  }

  public getSyncFileDetails(operationId: string): SyncFileDetail[] {
    this.ensureInitialized();
    return this.wordpressManager!.getSyncFileDetails(operationId);
  }

  // Note: Bulk file detail operations can be added if needed

  /**
   * Statistics
   */
  public getSyncStats(siteId: string): SyncStats {
    this.ensureInitialized();
    return this.wordpressManager!.getSyncStats(siteId);
  }

  // Note: Database statistics can be added to WordPressSQLiteManager if needed

  // ===========================================
  // EXPORT OPERATIONS
  // ===========================================

  /**
   * Export WordPress data to files
   */
  public async exportToFiles(options: ExportOptions): Promise<{
    success: boolean;
    exportedFiles: string[];
    totalSize: number;
    error?: string;
  }> {
    this.ensureInitialized();
    return await this.exportUtils!.exportToFiles(options);
  }

  public async exportPostsToWordPressXML(siteId: string, outputPath: string): Promise<{
    success: boolean;
    filePath?: string;
    error?: string;
  }> {
    this.ensureInitialized();
    return await this.exportUtils!.exportPostsToWordPressXML(siteId, outputPath);
  }

  public async exportPostsToMarkdown(siteId: string, outputPath: string): Promise<{
    success: boolean;
    exportedFiles: string[];
    error?: string;
  }> {
    this.ensureInitialized();
    return await this.exportUtils!.exportPostsToMarkdown(siteId, outputPath);
  }

  public async exportPostsToHTML(siteId: string, outputPath: string): Promise<{
    success: boolean;
    exportedFiles: string[];
    error?: string;
  }> {
    this.ensureInitialized();
    return await this.exportUtils!.exportPostsToHTML(siteId, outputPath);
  }

  public async exportPostsToJSON(siteId: string, outputPath: string): Promise<{
    success: boolean;
    filePath?: string;
    error?: string;
  }> {
    this.ensureInitialized();
    return await this.exportUtils!.exportPostsToJSON(siteId, outputPath);
  }



  // ===========================================
  // UTILITY OPERATIONS
  // ===========================================

  // Note: Database maintenance operations (vacuum, optimize, backup, restore) 
  // can be added to WordPressSQLiteManager if needed

  /**
   * Cleanup operations
   */
  public cleanup(): void {
    try {
      if (this.wordpressManager) {
        this.wordpressManager.close();
        this.wordpressManager = null;
      }
      
      if (this.exportUtils) {
        this.exportUtils.close();
        this.exportUtils = null;
      }
      
      
      this.isInitialized = false;
      this.initializationError = null;
      
      console.log('🧹 SQLite Manager cleaned up');
    } catch (error) {
      console.error('❌ Error during SQLite cleanup:', error);
    }
  }

  // ===========================================
  // PRIVATE HELPER METHODS
  // ===========================================

  /**
   * Ensure SQLite is initialized before operations
   */
  private ensureInitialized(): void {
    if (!this.isInitialized || !this.wordpressManager) {
      throw new Error(
        this.initializationError || 
        'SQLite Manager is not initialized. Please call initialize() first.'
      );
    }
  }


  /**
   * Get database path for debugging
   */
  public getDatabasePath(): string {
    return app.getPath('userData') + '/wordpress-sync/wordpress-sync.db';
  }
}

// Export singleton instance getter
export const getSQLiteManager = (): SQLiteManager => SQLiteManager.getInstance();

