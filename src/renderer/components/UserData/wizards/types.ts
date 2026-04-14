import { UserTable } from '../../../hooks/useUserData';

/**
 * Wizard mode determines which flow to use
 */
export type WizardMode = 'import' | 'upload';

/**
 * All possible wizard steps across all modes
 */
export type WizardStep =
  | 'file-selection'
  | 'parse-config'
  | 'island-selection'
  | 'column-split'
  | 'table-info'
  | 'column-mapping'
  | 'duplicate-detection'
  | 'preview'
  | 'importing'
  | 'complete';

/**
 * Duplicate detection configuration
 */
export interface DuplicateDetectionConfig {
  uniqueKeyColumns: string[];
  duplicateAction: 'skip' | 'update' | 'allow' | 'replace-date-range' | 'replace-all';
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

export type TableKind = 'sql' | 'bucket';

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
  tableKind: TableKind;
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

  // Sync configuration flags used by source-based sync launchers
  deleteAfterImport: boolean;
  archiveAfterImport: boolean;
  saveAsConfiguration: boolean;
  enableAutoSync: boolean;
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
  mode: 'import' | 'upload';
  preSelectedFile?: string;   // Skip file selection if provided
  targetTable?: UserTable;    // Required for upload mode
  onClose: () => void;
  onComplete: () => void;

  // Source-based sync metadata
  sourceType?: 'browser' | 'desktop';
  scriptFolderPath?: string;  // Path to browser automation script folder
  scriptName?: string;        // Name of the browser script
  folderName?: string;        // Name of the download folder
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
  { id: 'file-selection', label: 'Select File', modesApplicable: ['import', 'upload'] },
  { id: 'parse-config', label: 'Configure' },
  { id: 'island-selection', label: 'Select Islands', isConditional: true, modesApplicable: ['import'] },
  { id: 'column-split', label: 'Split Columns', isConditional: true },
  { id: 'table-info', label: 'Table Info', modesApplicable: ['import'], isConditional: true },
  { id: 'column-mapping', label: 'Map Columns' },
  { id: 'duplicate-detection', label: 'Duplicates' },
  { id: 'preview', label: 'Preview' },
  { id: 'importing', label: 'Processing' },
  { id: 'complete', label: 'Complete' },
];
