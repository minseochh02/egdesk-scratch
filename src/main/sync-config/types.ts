/**
 * Sync Configuration Types
 */

export type FileAction = 'keep' | 'archive' | 'delete';
export type SyncStatus = 'success' | 'failed' | 'partial' | 'never';

export interface SyncConfiguration {
  id: string;
  scriptFolderPath: string;
  scriptName: string;
  folderName: string;
  
  // Target SQL table
  targetTableId: string;
  
  // Parsing configuration
  headerRow: number;
  skipBottomRows: number;
  sheetIndex: number;
  
  // Column mappings
  columnMappings: Record<string, string>; // excelCol: tableCol
  
  // Duplicate detection
  uniqueKeyColumns?: string[]; // Columns that form unique key
  duplicateAction?: 'skip' | 'update' | 'allow'; // How to handle duplicates
  
  // File handling
  fileAction: FileAction;
  
  // Auto-sync settings
  enabled: boolean;
  autoSyncEnabled: boolean;
  
  // Status tracking
  lastSyncAt?: string;
  lastSyncStatus?: SyncStatus;
  lastSyncRowsImported: number;
  lastSyncRowsSkipped: number;
  lastSyncDuplicates: number;
  lastSyncError?: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface CreateSyncConfigurationData {
  scriptFolderPath: string;
  scriptName: string;
  folderName: string;
  targetTableId: string;
  headerRow?: number;
  skipBottomRows?: number;
  sheetIndex?: number;
  columnMappings: Record<string, string>;
  uniqueKeyColumns?: string[]; // Columns that form unique key
  duplicateAction?: 'skip' | 'update' | 'allow'; // How to handle duplicates
  fileAction?: FileAction;
  autoSyncEnabled?: boolean;
}

export interface UpdateSyncConfigurationData {
  targetTableId?: string;
  headerRow?: number;
  skipBottomRows?: number;
  sheetIndex?: number;
  columnMappings?: Record<string, string>;
  uniqueKeyColumns?: string[];
  duplicateAction?: 'skip' | 'update' | 'allow';
  fileAction?: FileAction;
  enabled?: boolean;
  autoSyncEnabled?: boolean;
}

export interface SyncActivityLog {
  id: string;
  configId: string;
  fileName: string;
  filePath: string;
  status: 'success' | 'failed' | 'partial';
  rowsImported: number;
  rowsSkipped: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

export interface CreateSyncActivityData {
  configId: string;
  fileName: string;
  filePath: string;
}

export interface CompleteSyncActivityData {
  status: 'success' | 'failed' | 'partial';
  rowsImported: number;
  rowsSkipped: number;
  duplicatesSkipped?: number;
  errorMessage?: string;
  durationMs: number;
}
