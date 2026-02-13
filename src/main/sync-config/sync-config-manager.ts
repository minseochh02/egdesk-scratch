import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import {
  SyncConfiguration,
  CreateSyncConfigurationData,
  UpdateSyncConfigurationData,
  SyncActivityLog,
  CreateSyncActivityData,
  CompleteSyncActivityData,
} from './types';

/**
 * Sync Configuration Database Manager
 *
 * Manages browser automation → SQL table sync configurations
 */
export class SyncConfigManager {
  constructor(private database: Database.Database) {}

  /**
   * Create a new sync configuration
   */
  createConfiguration(data: CreateSyncConfigurationData): SyncConfiguration {
    const id = randomUUID();
    const now = new Date().toISOString();

    // Validate column mappings
    if (!data.columnMappings || Object.keys(data.columnMappings).length === 0) {
      throw new Error('Column mappings cannot be empty');
    }

    const columnMappingsJson = JSON.stringify(data.columnMappings);

    const uniqueKeyColumnsJson = data.uniqueKeyColumns ? JSON.stringify(data.uniqueKeyColumns) : null;
    
    const stmt = this.database.prepare(`
      INSERT INTO sync_configurations (
        id, script_folder_path, script_name, folder_name,
        target_table_id, header_row, skip_bottom_rows, sheet_index,
        column_mappings, unique_key_columns, duplicate_action,
        file_action, enabled, auto_sync_enabled,
        last_sync_rows_imported, last_sync_rows_skipped, last_sync_duplicates,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.scriptFolderPath,
      data.scriptName,
      data.folderName,
      data.targetTableId,
      data.headerRow || 1,
      data.skipBottomRows || 0,
      data.sheetIndex || 0,
      columnMappingsJson,
      uniqueKeyColumnsJson,
      data.duplicateAction || 'skip',
      data.fileAction || 'archive',
      1, // enabled by default (SQLite boolean: 1 = true)
      data.autoSyncEnabled ? 1 : 0, // Convert boolean to SQLite integer
      0, // last_sync_rows_imported
      0, // last_sync_rows_skipped
      0, // last_sync_duplicates
      now,
      now
    );

    return this.getConfiguration(id)!;
  }

  /**
   * Get a configuration by ID
   */
  getConfiguration(configId: string): SyncConfiguration | null {
    const stmt = this.database.prepare(`
      SELECT * FROM sync_configurations WHERE id = ?
    `);
    const row = stmt.get(configId) as any;

    if (!row) return null;

    return this.mapRowToConfig(row);
  }

  /**
   * Get configuration by script folder path
   */
  getConfigurationByFolder(scriptFolderPath: string): SyncConfiguration | null {
    const stmt = this.database.prepare(`
      SELECT * FROM sync_configurations WHERE script_folder_path = ?
    `);
    const row = stmt.get(scriptFolderPath) as any;

    if (!row) return null;

    return this.mapRowToConfig(row);
  }

  /**
   * Get all configurations
   */
  getAllConfigurations(): SyncConfiguration[] {
    const stmt = this.database.prepare(`
      SELECT * FROM sync_configurations ORDER BY created_at DESC
    `);
    const rows = stmt.all() as any[];

    return rows.map((row) => this.mapRowToConfig(row));
  }

  /**
   * Get enabled configurations
   */
  getEnabledConfigurations(): SyncConfiguration[] {
    const stmt = this.database.prepare(`
      SELECT * FROM sync_configurations WHERE enabled = true ORDER BY created_at DESC
    `);
    const rows = stmt.all() as any[];

    return rows.map((row) => this.mapRowToConfig(row));
  }

  /**
   * Get auto-sync enabled configurations
   */
  getAutoSyncConfigurations(): SyncConfiguration[] {
    const stmt = this.database.prepare(`
      SELECT * FROM sync_configurations WHERE enabled = true AND auto_sync_enabled = true
    `);
    const rows = stmt.all() as any[];

    return rows.map((row) => this.mapRowToConfig(row));
  }

  /**
   * Update a configuration
   */
  updateConfiguration(configId: string, data: UpdateSyncConfigurationData): boolean {
    const current = this.getConfiguration(configId);
    if (!current) return false;

    const updates: string[] = [];
    const params: any[] = [];

    if (data.targetTableId !== undefined) {
      updates.push('target_table_id = ?');
      params.push(data.targetTableId);
    }
    if (data.headerRow !== undefined) {
      updates.push('header_row = ?');
      params.push(data.headerRow);
    }
    if (data.skipBottomRows !== undefined) {
      updates.push('skip_bottom_rows = ?');
      params.push(data.skipBottomRows);
    }
    if (data.sheetIndex !== undefined) {
      updates.push('sheet_index = ?');
      params.push(data.sheetIndex);
    }
    if (data.columnMappings !== undefined) {
      updates.push('column_mappings = ?');
      params.push(JSON.stringify(data.columnMappings));
    }
    if (data.uniqueKeyColumns !== undefined) {
      updates.push('unique_key_columns = ?');
      params.push(data.uniqueKeyColumns ? JSON.stringify(data.uniqueKeyColumns) : null);
    }
    if (data.duplicateAction !== undefined) {
      updates.push('duplicate_action = ?');
      params.push(data.duplicateAction);
    }
    if (data.fileAction !== undefined) {
      updates.push('file_action = ?');
      params.push(data.fileAction);
    }
    if (data.enabled !== undefined) {
      updates.push('enabled = ?');
      params.push(data.enabled ? 1 : 0); // Convert boolean to SQLite integer
    }
    if (data.autoSyncEnabled !== undefined) {
      updates.push('auto_sync_enabled = ?');
      params.push(data.autoSyncEnabled ? 1 : 0); // Convert boolean to SQLite integer
    }

    if (updates.length === 0) return false;

    params.push(configId);

    const stmt = this.database.prepare(`
      UPDATE sync_configurations
      SET ${updates.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...params);
    return true;
  }

  /**
   * Delete a configuration
   */
  deleteConfiguration(configId: string): boolean {
    const stmt = this.database.prepare('DELETE FROM sync_configurations WHERE id = ?');
    const result = stmt.run(configId);
    return result.changes > 0;
  }

  /**
   * Update last sync status
   */
  updateLastSyncStatus(
    configId: string,
    status: string,
    rowsImported: number,
    rowsSkipped: number,
    duplicates: number = 0,
    error?: string
  ): void {
    const now = new Date().toISOString();
    const stmt = this.database.prepare(`
      UPDATE sync_configurations
      SET last_sync_at = ?,
          last_sync_status = ?,
          last_sync_rows_imported = ?,
          last_sync_rows_skipped = ?,
          last_sync_duplicates = ?,
          last_sync_error = ?
      WHERE id = ?
    `);

    stmt.run(now, status, rowsImported, rowsSkipped, duplicates, error || null, configId);
  }

  /**
   * Create a sync activity log entry
   */
  createActivityLog(data: CreateSyncActivityData): SyncActivityLog {
    const id = randomUUID();
    const now = new Date().toISOString();

    const stmt = this.database.prepare(`
      INSERT INTO sync_activity_log (
        id, config_id, file_name, file_path,
        status, rows_imported, rows_skipped,
        started_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, data.configId, data.fileName, data.filePath, 'success', 0, 0, now);

    return {
      id,
      configId: data.configId,
      fileName: data.fileName,
      filePath: data.filePath,
      status: 'success',
      rowsImported: 0,
      rowsSkipped: 0,
      startedAt: now,
    };
  }

  /**
   * Complete an activity log entry
   */
  completeActivityLog(logId: string, data: CompleteSyncActivityData): void {
    const now = new Date().toISOString();

    const stmt = this.database.prepare(`
      UPDATE sync_activity_log
      SET status = ?,
          rows_imported = ?,
          rows_skipped = ?,
          error_message = ?,
          completed_at = ?,
          duration_ms = ?
      WHERE id = ?
    `);

    stmt.run(
      data.status,
      data.rowsImported,
      data.rowsSkipped,
      data.errorMessage || null,
      now,
      data.durationMs,
      logId
    );
  }

  /**
   * Get activity logs for a configuration
   */
  getActivityLogs(configId: string, limit: number = 50): SyncActivityLog[] {
    const stmt = this.database.prepare(`
      SELECT * FROM sync_activity_log
      WHERE config_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(configId, limit) as any[];
    return rows.map((row) => this.mapRowToActivityLog(row));
  }

  /**
   * Get recent activity logs
   */
  getRecentActivityLogs(limit: number = 50): SyncActivityLog[] {
    const stmt = this.database.prepare(`
      SELECT * FROM sync_activity_log
      ORDER BY started_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];
    return rows.map((row) => this.mapRowToActivityLog(row));
  }

  /**
   * Get statistics for a configuration
   */
  getConfigurationStats(configId: string): {
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    totalRowsImported: number;
    totalRowsSkipped: number;
  } {
    const stmt = this.database.prepare(`
      SELECT
        COUNT(*) as total_syncs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_syncs,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_syncs,
        SUM(rows_imported) as total_rows_imported,
        SUM(rows_skipped) as total_rows_skipped
      FROM sync_activity_log
      WHERE config_id = ?
    `);

    const result = stmt.get(configId) as any;

    return {
      totalSyncs: result.total_syncs || 0,
      successfulSyncs: result.successful_syncs || 0,
      failedSyncs: result.failed_syncs || 0,
      totalRowsImported: result.total_rows_imported || 0,
      totalRowsSkipped: result.total_rows_skipped || 0,
    };
  }

  /**
   * Map database row to SyncConfiguration
   */
  private mapRowToConfig(row: any): SyncConfiguration {
    let columnMappings: Record<string, string>;
    try {
      columnMappings = JSON.parse(row.column_mappings || '{}');
    } catch (error) {
      console.error('Failed to parse column mappings:', error);
      columnMappings = {};
    }

    let uniqueKeyColumns: string[] | undefined;
    try {
      uniqueKeyColumns = row.unique_key_columns ? JSON.parse(row.unique_key_columns) : undefined;
    } catch (error) {
      console.error('Failed to parse unique key columns:', error);
      uniqueKeyColumns = undefined;
    }

    return {
      id: row.id,
      scriptFolderPath: row.script_folder_path,
      scriptName: row.script_name,
      folderName: row.folder_name,
      targetTableId: row.target_table_id,
      headerRow: row.header_row,
      skipBottomRows: row.skip_bottom_rows,
      sheetIndex: row.sheet_index,
      columnMappings,
      uniqueKeyColumns,
      duplicateAction: row.duplicate_action,
      fileAction: row.file_action,
      enabled: row.enabled === 1 || row.enabled === true,
      autoSyncEnabled: row.auto_sync_enabled === 1 || row.auto_sync_enabled === true,
      lastSyncAt: row.last_sync_at,
      lastSyncStatus: row.last_sync_status,
      lastSyncRowsImported: row.last_sync_rows_imported,
      lastSyncRowsSkipped: row.last_sync_rows_skipped,
      lastSyncDuplicates: row.last_sync_duplicates || 0,
      lastSyncError: row.last_sync_error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map database row to SyncActivityLog
   */
  private mapRowToActivityLog(row: any): SyncActivityLog {
    return {
      id: row.id,
      configId: row.config_id,
      fileName: row.file_name,
      filePath: row.file_path,
      status: row.status,
      rowsImported: row.rows_imported,
      rowsSkipped: row.rows_skipped,
      errorMessage: row.error_message,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      durationMs: row.duration_ms,
    };
  }
}
