import { UserTable } from '../../../hooks/useUserData';

/**
 * Wizard mode determines which flow to use
 */
export type WizardMode = 'import' | 'upload' | 'browser-sync';

/**
 * All possible wizard steps across all modes
 */
export type WizardStep =
  | 'browser-folder-selection'  // browser-sync only
  | 'browser-file-selection'    // browser-sync only
  | 'file-selection'
  | 'parse-config'
  | 'island-selection'  // import/browser-sync only
  | 'column-split'
  | 'import-mode-selection'     // browser-sync only
  | 'table-info'        // import/browser-sync only (create-new mode)
  | 'existing-table-selection'  // browser-sync only (sync-existing mode)
  | 'column-mapping'
  | 'duplicate-detection'
  | 'preview'
  | 'importing'
  | 'complete';

/**
 * Step flow configuration for each mode
 */
export const STEP_FLOWS: Record<WizardMode, WizardStep[]> = {
  import: [
    'file-selection',
    'parse-config',
    'island-selection',  // conditional
    'column-split',      // conditional
    'table-info',
    'column-mapping',
    'duplicate-detection',
    'preview',
    'importing',
    'complete',
  ],
  upload: [
    'file-selection',
    'parse-config',
    'column-split',      // conditional
    'column-mapping',
    'duplicate-detection',
    'preview',
    'importing',
    'complete',
  ],
  'browser-sync': [
    'browser-folder-selection',
    'browser-file-selection',
    'parse-config',
    'island-selection',  // conditional
    'column-split',      // conditional
    'import-mode-selection',
    'table-info',        // conditional (create-new mode)
    'existing-table-selection', // conditional (sync-existing mode)
    'column-mapping',
    'duplicate-detection',
    'preview',
    'importing',
    'complete',
  ],
};

/**
 * Duplicate detection configuration
 */
export interface DuplicateDetectionConfig {
  uniqueKeyColumns: string[];
  duplicateAction: 'skip' | 'update' | 'allow' | 'replace-date-range';
  addTimestamp?: boolean;
}

/**
 * Import/Upload progress information
 */
export interface ImportProgress {
  rowsImported: number;
  rowsSkipped: number;
  duplicatesSkipped?: number;
  duplicateDetails?: Array<{
    rowIndex: number;
    uniqueKeyValues: Record<string, any>;
  }>;
  errorDetails?: Array<{
    rowIndex: number;
    error: string;
    rowData?: Record<string, any>;
  }>;
}

/**
 * Multi-table import results (import mode only)
 */
export interface MultiTableImportResult {
  tableName: string;
  displayName: string;
  rowsImported: number;
  rowsSkipped: number;
}

/**
 * Column split information
 */
export interface AppliedSplit {
  originalColumn: string;
  dateColumn: string;
  numberColumn: string;
}

/**
 * Browser download folder (browser-sync mode only)
 */
export interface BrowserDownloadFolder {
  scriptName: string;
  folderName: string;
  path: string;
  fileCount: number;
  excelFileCount: number;
  lastModified: Date;
  size: number;
}

/**
 * Browser download file (browser-sync mode only)
 */
export interface BrowserDownloadFile {
  name: string;
  path: string;
  scriptFolder: string;
  size: number;
  modified: Date;
}

/**
 * Import mode selection (browser-sync only)
 */
export type ImportMode = 'create-new' | 'sync-existing' | null;

/**
 * Centralized wizard state
 */
export interface WizardState {
  // File and parsing
  selectedFile: string | null;
  parsedData: any | null;
  selectedSheet: number;
  headerRow: number;
  skipBottomRows: number;

  // Column configuration
  columnMappings: Record<string, string> | null;
  mergeConfig: Record<string, { sources: string[]; separator: string }> | null;
  columnTypes: Record<string, string> | null;
  appliedSplits: AppliedSplit[];
  acceptedSplits: Set<string>;

  // Table info (import mode only)
  tableName: string;
  displayName: string;
  description: string;

  // Island selection (import mode only)
  selectedIslands: Set<number>;
  islandImportMode: 'separate' | 'merged';
  mergedTableName: string;
  mergedDisplayName: string;
  addMetadataColumns: boolean;

  // Duplicate detection
  duplicateDetectionSettings: DuplicateDetectionConfig;

  // Progress and results
  importProgress: ImportProgress | null;
  multiTableImportResults: MultiTableImportResult[] | null;
  isImporting: boolean;
  importError: string | null;

  // UI state
  showDuplicates: boolean;
  showErrors: boolean;
  error: string | null;

  // Browser-sync specific state
  downloadFolders: BrowserDownloadFolder[];
  downloadFiles: BrowserDownloadFile[];
  selectedFolder: BrowserDownloadFolder | null;
  selectedBrowserFile: BrowserDownloadFile | null;
  importMode: ImportMode;
  selectedTableId: string | null;
  existingTableColumnMappings: Record<string, string> | null;
  deleteAfterImport: boolean;
  archiveAfterImport: boolean;
  saveAsConfiguration: boolean;
  enableAutoSync: boolean;
  loadingBrowserFiles: boolean;

  // Edit mode flag
  isEditModeInitialized?: boolean;  // Tracks if state has been initialized from editingConfig
  browserSyncSettings?: {           // Browser sync settings for save/edit
    enabled: boolean;
    fileAction: 'keep' | 'archive' | 'delete';
    autoSyncEnabled: boolean;
  };
}

/**
 * Base props for step components
 */
export interface BaseStepProps {
  mode: WizardMode;
  targetTable?: UserTable;  // Required for upload mode
  wizardState: WizardState;
  onStateChange: (updates: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
  error: string | null;
  setError: (error: string | null) => void;
}

/**
 * Props for the unified wizard component
 */
export interface ExcelDataWizardProps {
  mode: 'import' | 'upload';  // browser-sync handled separately
  preSelectedFile?: string;   // Skip file selection if provided
  targetTable?: UserTable;    // Required for upload mode
  onClose: () => void;
  onComplete: () => void;

  // Browser-sync specific props
  isBrowserSync?: boolean;    // Indicates this is a browser sync import
  scriptFolderPath?: string;  // Path to browser automation script folder
  scriptName?: string;        // Name of the browser script
  folderName?: string;        // Name of the download folder
  editingConfig?: any;        // Existing sync configuration being edited
}

/**
 * Step configuration for rendering
 */
export interface StepConfig {
  id: WizardStep;
  label: string;
  isConditional?: boolean;
  modesApplicable?: WizardMode[];
}

/**
 * Step configurations with labels
 */
export const STEP_CONFIGS: StepConfig[] = [
  { id: 'browser-folder-selection', label: 'Select Automation', modesApplicable: ['browser-sync'] },
  { id: 'browser-file-selection', label: 'Select File', modesApplicable: ['browser-sync'] },
  { id: 'file-selection', label: 'Select File', modesApplicable: ['import', 'upload'] },
  { id: 'parse-config', label: 'Configure' },
  { id: 'island-selection', label: 'Select Islands', isConditional: true, modesApplicable: ['import', 'browser-sync'] },
  { id: 'column-split', label: 'Split Columns', isConditional: true },
  { id: 'import-mode-selection', label: 'Import Mode', modesApplicable: ['browser-sync'] },
  { id: 'table-info', label: 'Table Info', modesApplicable: ['import', 'browser-sync'], isConditional: true },
  { id: 'existing-table-selection', label: 'Select Table', modesApplicable: ['browser-sync'], isConditional: true },
  { id: 'column-mapping', label: 'Map Columns' },
  { id: 'duplicate-detection', label: 'Duplicates' },
  { id: 'preview', label: 'Preview' },
  { id: 'importing', label: 'Processing' },
  { id: 'complete', label: 'Complete' },
];
