import { useState, useCallback } from 'react';
import { WizardState, WizardMode } from '../types';

/**
 * Initial wizard state factory
 */
function createInitialState(
  mode: WizardMode,
  suggestedTableName?: string,
  isSourceSync?: boolean
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
    tableKind: 'sql',
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

    // Source-sync configuration
    deleteAfterImport: false,
    archiveAfterImport: isSourceSync || false,
    saveAsConfiguration: isSourceSync || false,
    enableAutoSync: isSourceSync || false,
  };
}

/**
 * Hook for managing wizard state
 */
export function useWizardState(mode: WizardMode, isSourceSync?: boolean) {
  const [state, setState] = useState<WizardState>(() => createInitialState(mode, undefined, isSourceSync));

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
    setState(createInitialState(mode, suggestedTableName, isSourceSync));
  }, [mode, isSourceSync]);

  return {
    state,
    updateState,
    resetState,
  };
}
