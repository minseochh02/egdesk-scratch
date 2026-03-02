import { useState, useCallback } from 'react';
import { WizardState, WizardMode } from '../types';

/**
 * Initial wizard state factory
 */
function createInitialState(mode: WizardMode, suggestedTableName?: string): WizardState {
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
      addTimestamp: mode === 'import' ? false : undefined,
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
    archiveAfterImport: mode === 'browser-sync',
    saveAsConfiguration: mode === 'browser-sync',
    enableAutoSync: mode === 'browser-sync',
    loadingBrowserFiles: mode === 'browser-sync',
  };
}

/**
 * Hook for managing wizard state
 */
export function useWizardState(mode: WizardMode) {
  const [state, setState] = useState<WizardState>(() => createInitialState(mode));

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
    setState(createInitialState(mode, suggestedTableName));
  }, [mode]);

  return {
    state,
    updateState,
    resetState,
  };
}
