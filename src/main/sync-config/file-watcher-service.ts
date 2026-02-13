import fs from 'fs';
import path from 'path';
import { FSWatcher } from 'fs';
import { SyncConfigManager } from './sync-config-manager';
import { parseExcelFile } from '../user-data/excel-parser';
import { getSQLiteManager } from '../sqlite/manager';

/**
 * File Watcher Service for Auto-Sync
 *
 * Monitors browser automation download folders and automatically imports
 * new Excel files based on saved sync configurations.
 */

interface WatcherInstance {
  configId: string;
  folderPath: string;
  watcher: FSWatcher;
  processedFiles: Set<string>;
}

export class FileWatcherService {
  private static instance: FileWatcherService | null = null;
  private watchers: Map<string, WatcherInstance> = new Map();
  private syncConfigManager: SyncConfigManager;
  private isInitialized: boolean = false;
  private processingFiles: Set<string> = new Set(); // Track files currently being processed

  private constructor(syncConfigManager: SyncConfigManager) {
    this.syncConfigManager = syncConfigManager;
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): FileWatcherService {
    if (!FileWatcherService.instance) {
      const manager = getSQLiteManager();
      const syncConfigManager = manager.getSyncConfigManager();
      FileWatcherService.instance = new FileWatcherService(syncConfigManager);
    }
    return FileWatcherService.instance;
  }

  /**
   * Initialize and start all auto-sync watchers
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('File Watcher Service already initialized');
      return;
    }

    console.log('🔍 Initializing File Watcher Service...');

    // Get all auto-sync enabled configurations
    const configs = this.syncConfigManager.getAutoSyncConfigurations();

    for (const config of configs) {
      try {
        await this.startWatcher(config.id);
      } catch (error) {
        console.error(`Failed to start watcher for config ${config.id}:`, error);
      }
    }

    this.isInitialized = true;
    console.log(`✅ File Watcher Service initialized with ${this.watchers.size} active watchers`);
  }

  /**
   * Start watching a folder for a specific configuration
   */
  public async startWatcher(configId: string): Promise<void> {
    // Check if already watching
    if (this.watchers.has(configId)) {
      console.log(`Watcher already running for config ${configId}`);
      return;
    }

    const config = this.syncConfigManager.getConfiguration(configId);
    if (!config) {
      throw new Error(`Configuration ${configId} not found`);
    }

    if (!config.enabled) {
      throw new Error(`Configuration ${configId} is disabled`);
    }

    if (!config.autoSyncEnabled) {
      throw new Error(`Auto-sync not enabled for configuration ${configId}`);
    }

    // Check if folder exists
    if (!fs.existsSync(config.scriptFolderPath)) {
      throw new Error(`Folder does not exist: ${config.scriptFolderPath}`);
    }

    // Get list of existing files to mark as already processed
    const processedFiles = new Set<string>();
    try {
      const existingFiles = fs.readdirSync(config.scriptFolderPath);
      existingFiles.forEach((file) => {
        if (this.isExcelFile(file)) {
          processedFiles.add(file);
        }
      });
    } catch (error) {
      console.error(`Error reading existing files in ${config.scriptFolderPath}:`, error);
    }

    // Create file system watcher
    const watcher = fs.watch(
      config.scriptFolderPath,
      { persistent: true, recursive: false },
      (eventType, filename) => {
        if (!filename) return;

        // Only process on 'rename' events (file creation/deletion)
        // 'change' events fire during file write, we want to wait until complete
        if (eventType === 'rename') {
          this.handleFileEvent(configId, filename);
        }
      }
    );

    const watcherInstance: WatcherInstance = {
      configId,
      folderPath: config.scriptFolderPath,
      watcher,
      processedFiles,
    };

    this.watchers.set(configId, watcherInstance);

    console.log(`✅ Started watching: ${config.scriptName} (${config.scriptFolderPath})`);
    console.log(`   📋 ${processedFiles.size} existing files marked as processed`);
  }

  /**
   * Stop watching a folder for a specific configuration
   */
  public stopWatcher(configId: string): void {
    const watcherInstance = this.watchers.get(configId);
    if (!watcherInstance) {
      console.log(`No active watcher for config ${configId}`);
      return;
    }

    watcherInstance.watcher.close();
    this.watchers.delete(configId);

    console.log(`🛑 Stopped watching config ${configId}`);
  }

  /**
   * Stop all watchers
   */
  public stopAllWatchers(): void {
    console.log('🛑 Stopping all file watchers...');
    for (const [configId] of this.watchers) {
      this.stopWatcher(configId);
    }
    this.isInitialized = false;
    console.log('✅ All watchers stopped');
  }

  /**
   * Get status of all watchers
   */
  public getWatcherStatus(): Array<{
    configId: string;
    folderPath: string;
    processedFilesCount: number;
  }> {
    return Array.from(this.watchers.values()).map((instance) => ({
      configId: instance.configId,
      folderPath: instance.folderPath,
      processedFilesCount: instance.processedFiles.size,
    }));
  }

  /**
   * Handle file system event
   */
  private async handleFileEvent(configId: string, filename: string): Promise<void> {
    const watcherInstance = this.watchers.get(configId);
    if (!watcherInstance) return;

    const filePath = path.join(watcherInstance.folderPath, filename);

    // Check if file exists (rename event also fires on delete)
    if (!fs.existsSync(filePath)) {
      return;
    }

    // Only process Excel files
    if (!this.isExcelFile(filename)) {
      return;
    }

    // Skip if already processed
    if (watcherInstance.processedFiles.has(filename)) {
      return;
    }

    // Skip if in "processed" or "failed" folders
    if (filename.includes('processed') || filename.includes('failed')) {
      return;
    }

    // Skip if currently being processed
    if (this.processingFiles.has(filePath)) {
      return;
    }

    console.log(`📂 New file detected: ${filename} in ${watcherInstance.folderPath}`);

    // Wait for file to be stable (fully written)
    await this.waitForFileStability(filePath);

    // Mark as being processed
    this.processingFiles.add(filePath);

    try {
      // Auto-import the file
      await this.autoImportFile(configId, filePath, filename);

      // Mark as processed
      watcherInstance.processedFiles.add(filename);
    } catch (error) {
      console.error(`Failed to auto-import ${filename}:`, error);
    } finally {
      // Remove from processing set
      this.processingFiles.delete(filePath);
    }
  }

  /**
   * Wait for file to be stable (fully written)
   */
  private async waitForFileStability(filePath: string, maxWaitMs: number = 5000): Promise<void> {
    const checkInterval = 500; // Check every 500ms
    const maxChecks = Math.ceil(maxWaitMs / checkInterval);
    let lastSize = -1;
    let stableCount = 0;

    for (let i = 0; i < maxChecks; i++) {
      try {
        const stats = fs.statSync(filePath);
        const currentSize = stats.size;

        if (currentSize === lastSize) {
          stableCount++;
          // File size hasn't changed for 2 consecutive checks
          if (stableCount >= 2) {
            console.log(`✓ File stable: ${path.basename(filePath)} (${currentSize} bytes)`);
            return;
          }
        } else {
          stableCount = 0;
          lastSize = currentSize;
        }

        await new Promise((resolve) => setTimeout(resolve, checkInterval));
      } catch (error) {
        // File might have been deleted or moved
        throw new Error(`File became inaccessible: ${filePath}`);
      }
    }

    console.warn(`⚠️ File may not be fully stable: ${path.basename(filePath)}`);
  }

  /**
   * Automatically import a file based on configuration
   */
  private async autoImportFile(configId: string, filePath: string, filename: string): Promise<void> {
    const config = this.syncConfigManager.getConfiguration(configId);
    if (!config) {
      throw new Error(`Configuration ${configId} not found`);
    }

    const startTime = Date.now();

    // Create activity log
    const activityLog = this.syncConfigManager.createActivityLog({
      configId,
      fileName: filename,
      filePath,
    });

    console.log(`🔄 Auto-importing: ${filename}`);
    console.log(`   📊 Target table: ${config.targetTableId}`);
    console.log(`   ⚙️ Settings: header=${config.headerRow}, skip=${config.skipBottomRows}`);

    try {
      // Parse Excel file
      const parsedData = await parseExcelFile(filePath, {
        headerRow: config.headerRow,
        skipBottomRows: config.skipBottomRows,
      });

      const sheet = parsedData.sheets[config.sheetIndex];
      if (!sheet) {
        throw new Error(`Sheet index ${config.sheetIndex} not found in Excel file`);
      }

      // Get user data manager
      const manager = getSQLiteManager();
      const userDataManager = manager.getUserDataManager();

      // Get target table
      const targetTable = userDataManager.getTable(config.targetTableId);
      if (!targetTable) {
        throw new Error(`Target table ${config.targetTableId} not found`);
      }

      // Create import operation
      const importOp = userDataManager.createImportOperation({
        tableId: config.targetTableId,
        fileName: filename,
        totalRows: sheet.rows.length,
      });

      // Map and insert rows
      const mappedRows = sheet.rows.map((row) => {
        const mappedRow: Record<string, any> = {};
        for (const [excelCol, tableCol] of Object.entries(config.columnMappings)) {
          const colIndex = sheet.headers.indexOf(excelCol);
          if (colIndex !== -1) {
            mappedRow[tableCol] = row[colIndex];
          }
        }
        return mappedRow;
      });

      // Insert rows (correct signature: tableId, rows)
      const { inserted, skipped, duplicates } = userDataManager.insertRows(
        config.targetTableId,
        mappedRows
      );

      // Complete import operation
      userDataManager.completeImportOperation(importOp.id, {
        rowsImported: inserted,
        rowsSkipped: skipped,
      });

      const duration = Date.now() - startTime;

      // Update configuration status
      this.syncConfigManager.updateLastSyncStatus(
        configId,
        'success',
        inserted,
        skipped,
        duplicates
      );

      // Complete activity log
      this.syncConfigManager.completeActivityLog(activityLog.id, {
        status: skipped > 0 ? 'partial' : 'success',
        rowsImported: inserted,
        rowsSkipped: skipped,
        duplicatesSkipped: duplicates,
        durationMs: duration,
      });

      console.log(`✅ Auto-import complete: ${filename}`);
      console.log(`   ✓ ${inserted} rows imported`);
      if (skipped > 0) console.log(`   ⚠️ ${skipped} rows skipped (errors)`);
      if (duplicates > 0) console.log(`   🔄 ${duplicates} duplicates handled`);
      console.log(`   ⏱️ ${duration}ms`);

      // Handle file after import
      await this.handleFileAfterImport(filePath, config.fileAction);

      // Send success notification
      let notificationBody = `${inserted} rows imported to ${targetTable.displayName}`;
      if (duplicates > 0) {
        notificationBody += `\n${duplicates} duplicates ${config.duplicateAction || 'skipped'}`;
      }
      
      this.sendNotification({
        title: '✅ Auto-Sync Complete',
        body: `${filename}\n${notificationBody}`,
        type: 'success',
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update configuration status
      this.syncConfigManager.updateLastSyncStatus(
        configId,
        'failed',
        0,
        0,
        0,
        errorMessage
      );

      // Complete activity log
      this.syncConfigManager.completeActivityLog(activityLog.id, {
        status: 'failed',
        rowsImported: 0,
        rowsSkipped: 0,
        errorMessage,
        durationMs: duration,
      });

      console.error(`❌ Auto-import failed: ${filename}`);
      console.error(`   Error: ${errorMessage}`);

      // Move file to failed folder
      await this.moveToFailedFolder(filePath);

      // Send error notification
      this.sendNotification({
        title: '❌ Auto-Sync Failed',
        body: `${filename}\n${errorMessage}`,
        type: 'error',
      });

      throw error;
    }
  }

  /**
   * Handle file after successful import
   */
  private async handleFileAfterImport(filePath: string, action: 'keep' | 'archive' | 'delete'): Promise<void> {
    if (action === 'keep') {
      console.log(`📁 Keeping file: ${path.basename(filePath)}`);
      return;
    }

    if (action === 'delete') {
      try {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Deleted file: ${path.basename(filePath)}`);
      } catch (error) {
        console.error(`Failed to delete file ${filePath}:`, error);
      }
      return;
    }

    if (action === 'archive') {
      const folderPath = path.dirname(filePath);
      const processedFolder = path.join(folderPath, 'processed');

      // Create processed folder if it doesn't exist
      if (!fs.existsSync(processedFolder)) {
        fs.mkdirSync(processedFolder, { recursive: true });
      }

      const fileName = path.basename(filePath);
      let targetPath = path.join(processedFolder, fileName);

      // If file exists, append timestamp
      if (fs.existsSync(targetPath)) {
        const ext = path.extname(fileName);
        const base = path.basename(fileName, ext);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        targetPath = path.join(processedFolder, `${base}-${timestamp}${ext}`);
      }

      try {
        fs.renameSync(filePath, targetPath);
        console.log(`🗂️ Archived file: ${fileName} → processed/`);
      } catch (error) {
        console.error(`Failed to archive file ${filePath}:`, error);
      }
    }
  }

  /**
   * Move file to failed folder
   */
  private async moveToFailedFolder(filePath: string): Promise<void> {
    const folderPath = path.dirname(filePath);
    const failedFolder = path.join(folderPath, 'failed');

    // Create failed folder if it doesn't exist
    if (!fs.existsSync(failedFolder)) {
      fs.mkdirSync(failedFolder, { recursive: true });
    }

    const fileName = path.basename(filePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);
    const targetPath = path.join(failedFolder, `${base}-${timestamp}${ext}`);

    try {
      fs.renameSync(filePath, targetPath);
      console.log(`⚠️ Moved to failed folder: ${fileName}`);
    } catch (error) {
      console.error(`Failed to move file to failed folder:`, error);
    }
  }

  /**
   * Check if file is an Excel file
   */
  private isExcelFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return ['.xlsx', '.xls', '.xlsm'].includes(ext);
  }

  /**
   * Send desktop notification
   */
  private sendNotification(options: {
    title: string;
    body: string;
    type: 'success' | 'error' | 'info';
  }): void {
    // Import Notification at runtime to avoid circular dependencies
    const { Notification } = require('electron');

    if (Notification.isSupported()) {
      const notification = new Notification({
        title: options.title,
        body: options.body,
        silent: false,
      });

      notification.show();
    }
  }
}
