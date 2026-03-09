import { useState, useCallback } from 'react';
import { WizardState, WizardMode } from '../types';

/**
 * Initial wizard state factory
 */
function createInitialState(
  mode: WizardMode,
  suggestedTableName?: string,
  isBrowserSync?: boolean
): WizardState {
  return {
    // File and parsing
    selectedFile: null,
    parsedData: null,
    selectedSheet: 0,
    headerRow: 1,
    skipBottomRows: 0,

    // Column configuration
    columnMappings: null,
    mergeConfig: null,
    columnTypes: null,
    appliedSplits: [],
    acceptedSplits: new Set(),

    // Table info (import mode only)
    tableName: suggestedTableName || '',
    displayName: suggestedTableName ? suggestedTableName.replace(/_/g, ' ') : '',
    description: '',

    // Island selection (import mode only)
    selectedIslands: new Set(),
    islandImportMode: 'separate',
    mergedTableName: '',
    mergedDisplayName: '',
    addMetadataColumns: true,

    // Duplicate detection
    duplicateDetectionSettings: {
      uniqueKeyColumns: [],
      duplicateAction: 'skip',
      addTimestamp: mode === 'import' ? false : true, // Default true for upload mode
    },

    // Progress and results
    importProgress: null,
    multiTableImportResults: null,
    isImporting: false,
    importError: null,

    // UI state
    showDuplicates: false,
    showErrors: false,
    error: null,

    // Browser-sync specific state
    downloadFolders: [],
    downloadFiles: [],
    selectedFolder: null,
    selectedBrowserFile: null,
    importMode: null,
    selectedTableId: null,
    existingTableColumnMappings: null,
    deleteAfterImport: false,
    archiveAfterImport: isBrowserSync || false,
    saveAsConfiguration: isBrowserSync || false,
    enableAutoSync: isBrowserSync || false,
    loadingBrowserFiles: isBrowserSync || false,
  };
}

/**
 * Hook for managing wizard state
 */
export function useWizardState(mode: WizardMode, isBrowserSync?: boolean) {
  const [state, setState] = useState<WizardState>(() => createInitialState(mode, undefined, isBrowserSync));

  /**
   * Update wizard state with partial updates
   */
  const updateState = useCallback((updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  /**
   * Reset wizard state
   */
  const resetState = useCallback((suggestedTableName?: string) => {
    setState(createInitialState(mode, suggestedTableName, isBrowserSync));
  }, [mode, isBrowserSync]);

  return {
    state,
    updateState,
    resetState,
  };
}
