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
   * Reload and start watchers for any new configurations
   * Useful after importing sync configs from SQL
   */
  public async reload(): Promise<void> {
    console.log('🔄 Reloading File Watcher Service...');

    // Get all auto-sync enabled configurations
    const configs = this.syncConfigManager.getAutoSyncConfigurations();
    let newWatchersStarted = 0;

    for (const config of configs) {
      // Only start watcher if not already watching
      if (!this.watchers.has(config.id)) {
        try {
          await this.startWatcher(config.id);
          newWatchersStarted++;
        } catch (error) {
          console.error(`Failed to start watcher for config ${config.id}:`, error);
        }
      }
    }

    this.isInitialized = true;
    console.log(`✅ File Watcher Service reloaded: ${newWatchersStarted} new watcher(s) started, ${this.watchers.size} total active`);
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
    console.log(`\n📋 [SYNC CONFIG] Configuration loaded from database:`);
    console.log(`   Column mappings (${Object.keys(config.columnMappings).length} entries):`, JSON.stringify(config.columnMappings, null, 2));
    console.log(`   Duplicate action: ${config.duplicateAction}`);
    console.log(`   Unique key columns:`, config.uniqueKeyColumns);

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

      // ========================================
      // DATA TRANSFORMATION PIPELINE
      // ========================================
      // This section transforms raw Excel data into the format expected by the target table.
      // The order is CRITICAL:
      //   1. Islands → Merge first (each island has its own split suggestions already applied)
      //   2. Config Splits → Apply saved splits from browser sync config (for non-island sheets)
      //   3. Auto-detected Splits → Fall back to auto-detected splits (for non-island sheets)
      //
      // IMPORTANT: Islands MUST be checked first, because:
      //   - Island sheets have multiple tables within one sheet
      //   - Each island gets splits applied individually BEFORE merging
      //   - If we apply config.appliedSplits to the raw sheet, we skip island detection
      //   - This causes column mapping failures because the data structure is wrong
      // ========================================

      let dataToSync = sheet.rows;
      let headersToSync = sheet.headers;
      const { applySplitColumn } = require('../user-data/excel-parser');

      // PRIORITY 1: Always check for islands FIRST (islands already have their splits applied per-island)
      if (sheet.detectedIslands && sheet.detectedIslands.length > 0) {
        console.log(`🏝️  Found ${sheet.detectedIslands.length} data island(s), merging with pivot table handling...`);

        const { mergeIslands } = require('../user-data/excel-parser');

        // STEP 1: Apply column splits to each island BEFORE merging
        const islandsWithSplitsApplied = sheet.detectedIslands.map((island) => {
          if (!island.splitSuggestions || island.splitSuggestions.length === 0) {
            return island;
          }

          console.log(`   ✂️  Applying ${island.splitSuggestions.length} column split(s) to island "${island.title}"`);

          // Apply each split suggestion
          let modifiedIsland = island;
          for (const suggestion of island.splitSuggestions) {
            if (suggestion.pattern === 'date-with-number' && suggestion.suggestedColumns.length === 2) {
              // Auto-apply date-with-number splits
              const dateCol = suggestion.suggestedColumns[0];
              const numberCol = suggestion.suggestedColumns[1];

              console.log(`      "${suggestion.originalColumn}" → ["${dateCol.name}" (${dateCol.type}), "${numberCol.name}" (${numberCol.type})]`);

              // applySplitColumn expects a sheet-like structure, island has same structure
              modifiedIsland = applySplitColumn(
                modifiedIsland as any,
                suggestion.originalColumn,
                { date: dateCol.name, number: numberCol.name }
              );
            }
          }

          return modifiedIsland;
        });

        // STEP 2: Merge the islands (now with splits applied)
        const merged = mergeIslands(islandsWithSplitsApplied, {
          addMetadataColumns: true,  // Add 회사명, 기간, 계정코드_메타, 계정명_메타
          addIslandIndex: false,
        });

        dataToSync = merged.rows;
        headersToSync = merged.headers;

        console.log(`   ✅ Merged ${merged.mergedIslandCount} islands: ${merged.rows.length} total rows`);
        console.log(`   📋 Headers: ${headersToSync.slice(0, 5).join(', ')}...`);
      } else if (config.appliedSplits && config.appliedSplits.length > 0) {
        // PRIORITY 2: For non-island sheets, apply saved column splits from configuration
        console.log(`✂️  Applying ${config.appliedSplits.length} saved column split(s) from configuration...`);

        let modifiedSheet: any = sheet;
        for (const split of config.appliedSplits) {
          console.log(`   "${split.originalColumn}" → ["${split.dateColumn}", "${split.numberColumn}"]`);
          modifiedSheet = applySplitColumn(
            modifiedSheet,
            split.originalColumn,
            { date: split.dateColumn, number: split.numberColumn }
          );
        }

        dataToSync = modifiedSheet.rows;
        headersToSync = modifiedSheet.headers;
        console.log(`✅ Saved splits applied: ${headersToSync.length} columns total`);
      } else if (sheet.splitSuggestions && sheet.splitSuggestions.length > 0) {
        // PRIORITY 3: For non-island sheets with no saved splits, apply auto-detected split suggestions
        console.log(`✂️  Applying ${sheet.splitSuggestions.length} auto-detected column split(s) to sheet...`);

        let modifiedSheet: any = sheet;
        for (const suggestion of sheet.splitSuggestions) {
          if (suggestion.pattern === 'date-with-number' && suggestion.suggestedColumns.length === 2) {
            const dateCol = suggestion.suggestedColumns[0];
            const numberCol = suggestion.suggestedColumns[1];

            console.log(`   "${suggestion.originalColumn}" → ["${dateCol.name}" (${dateCol.type}), "${numberCol.name}" (${numberCol.type})]`);

            modifiedSheet = applySplitColumn(
              modifiedSheet,
              suggestion.originalColumn,
              { date: dateCol.name, number: numberCol.name }
            );
          }
        }

        dataToSync = modifiedSheet.rows;
        headersToSync = modifiedSheet.headers;
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
        totalRows: dataToSync.length,
      });

      // Debug: Log data structure before mapping
      const firstRowKeys = Object.keys(dataToSync[0] || {});
      console.log(`\n🔍 ===== COLUMN MAPPING DEBUG =====`);
      console.log(`🔍 Data before mapping - first row keys (${firstRowKeys.length}):`, JSON.stringify(firstRowKeys));
      console.log(`🔍 Headers to sync (${headersToSync.length}):`, JSON.stringify(headersToSync));
      console.log(`🔍 Column mappings (${Object.keys(config.columnMappings).length} entries):`, JSON.stringify(config.columnMappings, null, 2));

      // Check for columns in data that are NOT in mappings
      const unmappedColumns = firstRowKeys.filter(key => !(key in config.columnMappings));
      if (unmappedColumns.length > 0) {
        console.log(`⚠️  WARNING: Columns in data but NOT in mappings (will be dropped):`, JSON.stringify(unmappedColumns));
      }

      // Check for mappings that reference columns NOT in data
      const missingDataColumns = Object.keys(config.columnMappings).filter(key => !firstRowKeys.includes(key));
      if (missingDataColumns.length > 0) {
        console.log(`⚠️  WARNING: Mappings reference columns NOT in data:`, JSON.stringify(missingDataColumns));
      }

      // Map and insert rows
      const mappedRows = dataToSync.map((row) => {
        const mappedRow: Record<string, any> = {};
        for (const [excelCol, tableCol] of Object.entries(config.columnMappings)) {
          // Row is an object with column names as keys, not an array
          mappedRow[tableCol] = row[excelCol];
        }
        return mappedRow;
      });

      // Debug: Log data structure after mapping
      const mappedRowKeys = Object.keys(mappedRows[0] || {});
      console.log(`🔍 Data after mapping - first row keys (${mappedRowKeys.length}):`, JSON.stringify(mappedRowKeys));
      console.log(`🔍 First mapped row sample:`, mappedRows[0]);
      console.log(`   Column count change: ${firstRowKeys.length} → ${mappedRowKeys.length} (diff: ${mappedRowKeys.length - firstRowKeys.length})`);
      console.log(`🔍 ===== END MAPPING DEBUG =====\n`);

      // Filter out rows where date columns are empty/null (summary rows like 이월잔액, 합계, etc.)
      // BUT only if table has date columns - tables without dates should import all rows
      const dateColumns = targetTable.schema.filter(
        col => col.type === 'DATE' && col.name !== 'imported_at'
      ).map(col => col.name);

      let filteredRows = mappedRows;

      if (dateColumns.length > 0) {
        // Table has date columns - filter out rows where ALL date columns are null
        filteredRows = mappedRows.filter((row, idx) => {
          // Keep row if ANY date column has a non-empty value
          const hasValidDate = dateColumns.some(dateCol => {
            const value = row[dateCol];
            return value !== null && value !== undefined && value !== '';
          });

          // Log filtered rows
          if (!hasValidDate && idx < 5) {
            console.log(`⏭️  Skipping row ${idx + 1} (empty date columns):`, row);
          }

          return hasValidDate;
        });

        const skippedCount = mappedRows.length - filteredRows.length;
        if (skippedCount > 0) {
          console.log(`⏭️  Filtered out ${skippedCount} row(s) with empty date columns (summary/subtotal rows)`);
        }
      } else {
        // Table has no date columns - import all rows without filtering
        console.log(`ℹ️  Table has no date columns - importing all ${mappedRows.length} row(s) without date filtering`);
      }

      // Insert rows with duplicate handling settings from config
      const { inserted, skipped, duplicates } = userDataManager.insertRowsWithSettings(
        config.targetTableId,
        filteredRows,
        {
          uniqueKeyColumns: config.uniqueKeyColumns || [],
          duplicateAction: config.duplicateAction || 'skip',
        }
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
