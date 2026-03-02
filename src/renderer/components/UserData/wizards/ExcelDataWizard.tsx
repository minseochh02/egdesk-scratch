import React, { useState } from 'react';
import { useUserData } from '../../../hooks/useUserData';
import { useWizardState } from './hooks/useWizardState';
import { ExcelDataWizardProps, WizardStep, STEP_CONFIGS } from './types';
import { FileSelectionStep } from './steps/FileSelectionStep';
import { ParseConfigStep } from './steps/ParseConfigStep';
import { IslandSelectionStep } from './steps/IslandSelectionStep';
import { ColumnSplitStep } from './steps/ColumnSplitStep';
import { TableInfoStep } from './steps/TableInfoStep';
import { DuplicateDetectionStep } from './steps/DuplicateDetectionStep';
import { PreviewStep } from './steps/PreviewStep';
import { ProgressStep } from './steps/ProgressStep';
import { CompletionStep } from './steps/CompletionStep';
import { VisualColumnMapper } from '../VisualColumnMapper';

/**
 * ExcelDataWizard - Unified wizard shell for both import and upload modes
 * Consolidates ImportWizard and ExcelUploadDialog logic
 */
export const ExcelDataWizard: React.FC<ExcelDataWizardProps> = ({
  mode,
  preSelectedFile,
  targetTable,
  onClose,
  onComplete,
}) => {
  const {
    parseExcel,
    importExcel,
    syncToExistingTable,
    selectExcelFile,
    validateTableName,
  } = useUserData();

  const { state, updateState } = useWizardState(mode);
  const [currentStep, setCurrentStep] = useState<WizardStep>(
    preSelectedFile ? 'parse-config' : 'file-selection'
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingSplits, setPendingSplits] = useState<Array<{ originalColumn: string; dateColumn: string; numberColumn: string }>>([]);

  // Initialize with pre-selected file if provided
  React.useEffect(() => {
    if (preSelectedFile && !state.selectedFile) {
      updateState({ selectedFile: preSelectedFile });
      // Auto-trigger parse step for pre-selected files
      if (currentStep === 'parse-config') {
        // User needs to click Next to parse
      }
    }
  }, [preSelectedFile, state.selectedFile, updateState, currentStep]);

  // File selection handler
  const handleFileSelect = async () => {
    try {
      setError(null);
      const filePath = await selectExcelFile();

      if (!filePath) return;

      updateState({ selectedFile: filePath });
      setCurrentStep('parse-config');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select file');
    }
  };

  // Parse config completion handler
  const handleParseConfigComplete = async () => {
    try {
      setError(null);

      const parsed = await parseExcel(state.selectedFile!, {
        headerRow: state.headerRow,
        skipBottomRows: state.skipBottomRows,
      });

      updateState({
        parsedData: parsed,
        tableName: parsed.suggestedTableName,
        displayName: parsed.suggestedTableName.replace(/_/g, ' '),
        selectedSheet: 0,
        acceptedSplits: new Set(),
        selectedIslands: new Set(),
      });

      // Determine next step based on mode and data
      const currentSheet = parsed.sheets[0];

      if (mode === 'import') {
        // Import mode: check islands → splits → table-info
        if (currentSheet.detectedIslands && currentSheet.detectedIslands.length > 0) {
          setCurrentStep('island-selection');
        } else if (currentSheet.splitSuggestions && currentSheet.splitSuggestions.length > 0) {
          setCurrentStep('column-split');
        } else {
          setCurrentStep('table-info');
        }
      } else {
        // Upload mode: check splits → column-mapping
        if (currentSheet.splitSuggestions && currentSheet.splitSuggestions.length > 0) {
          setCurrentStep('column-split');
        } else {
          setCurrentStep('column-mapping');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse Excel file');
    }
  };

  // Apply column splits
  const handleApplySplits = () => {
    if (!state.parsedData) return;

    const currentSheet = state.parsedData.sheets[state.selectedSheet];
    if (!currentSheet.splitSuggestions) {
      // No suggestions, skip to next step
      proceedAfterSplits();
      return;
    }

    // Apply accepted splits
    let updatedSheet = currentSheet;
    const splits: Array<{ originalColumn: string; dateColumn: string; numberColumn: string }> = [];

    state.acceptedSplits.forEach((originalColumn) => {
      const suggestion = currentSheet.splitSuggestions?.find(
        (s) => s.originalColumn === originalColumn
      );

      if (suggestion) {
        const newHeaders = [...updatedSheet.headers];
        const originalIndex = newHeaders.indexOf(originalColumn);

        if (originalIndex !== -1) {
          const dateColName = suggestion.suggestedColumns[0].name;
          const numberColName = suggestion.suggestedColumns[1].name;

          splits.push({
            originalColumn,
            dateColumn: dateColName,
            numberColumn: numberColName,
          });

          newHeaders.splice(originalIndex, 1, dateColName, numberColName);

          const dateWithNumberPattern4Digit = /^(\d{4}[-/]\d{2}[-/]\d{2})\s*-?(\d+)$/;
          const dateWithNumberPattern2Digit = /^(\d{2}[-/]\d{2}[-/]\d{2})\s*-?(\d+)$/;

          const newRows = updatedSheet.rows.map((row: any) => {
            const newRow = { ...row };
            const originalValue = row[originalColumn];

            delete newRow[originalColumn];

            if (typeof originalValue === 'string') {
              const trimmed = originalValue.trim();
              let match = trimmed.match(dateWithNumberPattern4Digit);
              if (!match) {
                match = trimmed.match(dateWithNumberPattern2Digit);
              }

              if (match) {
                newRow[dateColName] = match[1];
                newRow[numberColName] = parseInt(match[2], 10);
              } else {
                newRow[dateColName] = originalValue;
                newRow[numberColName] = null;
              }
            } else {
              newRow[dateColName] = originalValue;
              newRow[numberColName] = null;
            }

            return newRow;
          });

          const newDetectedTypes = [...updatedSheet.detectedTypes];
          newDetectedTypes.splice(originalIndex, 1, 'DATE', 'INTEGER');

          updatedSheet = {
            ...updatedSheet,
            headers: newHeaders,
            rows: newRows,
            detectedTypes: newDetectedTypes,
          };
        }
      }
    });

    // Update parsed data with modified sheet
    const newParsedData = { ...state.parsedData };
    newParsedData.sheets[state.selectedSheet] = updatedSheet;

    console.log('[DEBUG] Applied splits:', splits);
    console.log('[DEBUG] Accepted splits from state:', Array.from(state.acceptedSplits));

    updateState({
      parsedData: newParsedData,
      appliedSplits: splits,
    });

    proceedAfterSplits();
  };

  const proceedAfterSplits = () => {
    if (mode === 'import') {
      setCurrentStep('table-info');
    } else {
      setCurrentStep('column-mapping');
    }
  };

  // Column mapping completion handler
  const handleColumnMappingComplete = (
    mappings: Record<string, string>,
    mergeConfiguration: Record<string, { sources: string[]; separator: string }>
  ) => {
    updateState({
      columnMappings: mappings,
      mergeConfig: mergeConfiguration,
    });
    setCurrentStep('duplicate-detection');
  };

  // Navigation handlers
  const handleBack = () => {
    if (currentStep === 'parse-config') {
      if (preSelectedFile) {
        // Can't go back if file was pre-selected
        onClose();
      } else {
        setCurrentStep('file-selection');
        updateState({ selectedFile: null });
      }
    } else if (currentStep === 'island-selection') {
      setCurrentStep('parse-config');
    } else if (currentStep === 'column-split') {
      const currentSheet = state.parsedData?.sheets[state.selectedSheet];
      if (mode === 'import' && currentSheet?.detectedIslands && currentSheet.detectedIslands.length > 0) {
        setCurrentStep('island-selection');
      } else {
        setCurrentStep('parse-config');
      }
    } else if (currentStep === 'table-info') {
      const currentSheet = state.parsedData?.sheets[state.selectedSheet];
      if (currentSheet?.splitSuggestions && currentSheet.splitSuggestions.length > 0) {
        setCurrentStep('column-split');
      } else if (currentSheet?.detectedIslands && currentSheet.detectedIslands.length > 0) {
        setCurrentStep('island-selection');
      } else {
        setCurrentStep('parse-config');
      }
    } else if (currentStep === 'column-mapping') {
      if (mode === 'import') {
        setCurrentStep('table-info');
      } else {
        const currentSheet = state.parsedData?.sheets[state.selectedSheet];
        if (currentSheet?.splitSuggestions && currentSheet.splitSuggestions.length > 0) {
          setCurrentStep('column-split');
        } else {
          setCurrentStep('parse-config');
        }
      }
      updateState({ columnMappings: null });
    } else if (currentStep === 'duplicate-detection') {
      setCurrentStep('column-mapping');
    } else if (currentStep === 'preview') {
      setCurrentStep('duplicate-detection');
    }
  };

  const handleNext = async () => {
    if (currentStep === 'parse-config') {
      await handleParseConfigComplete();
      return;
    }

    if (currentStep === 'island-selection') {
      // Handle island selection completion
      // This will be handled by the wizard based on selected islands
      const currentSheet = state.parsedData?.sheets[state.selectedSheet];
      if (currentSheet?.splitSuggestions && currentSheet.splitSuggestions.length > 0) {
        setCurrentStep('column-split');
      } else {
        setCurrentStep('table-info');
      }
      return;
    }

    if (currentStep === 'column-split') {
      handleApplySplits();
      return;
    }

    if (currentStep === 'table-info') {
      // Validate table name
      if (!state.tableName.trim()) {
        setError('Please enter a table name');
        return;
      }

      if (!state.displayName.trim()) {
        setError('Please enter a display name');
        return;
      }

      try {
        const validation = await validateTableName(state.tableName);

        if (!validation.available) {
          setError(`Table name "${validation.sanitizedName}" is already in use. Please choose a different name.`);
          return;
        }

        setError(null);
        setCurrentStep('column-mapping');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to validate table name');
      }
      return;
    }

    if (currentStep === 'duplicate-detection') {
      setCurrentStep('preview');
      return;
    }

    if (currentStep === 'preview') {
      // Start import/upload
      await handleFinalAction();
      return;
    }
  };

  // Final import/upload action
  const handleFinalAction = async () => {
    setCurrentStep('importing');
    updateState({ isImporting: true, importError: null });

    try {
      if (mode === 'import') {
        console.log('[DEBUG] Importing with appliedSplits:', state.appliedSplits);
        const result = await importExcel({
          filePath: state.selectedFile!,
          sheetIndex: state.selectedSheet,
          tableName: state.tableName,
          displayName: state.displayName,
          description: state.description.trim() || undefined,
          columnMappings: state.columnMappings || undefined,
          columnTypes: state.columnTypes || undefined,
          mergeConfig: state.mergeConfig || undefined,
          appliedSplits: state.appliedSplits.length > 0 ? state.appliedSplits : undefined,
          headerRow: state.headerRow,
          skipBottomRows: state.skipBottomRows,
          uniqueKeyColumns: state.duplicateDetectionSettings.uniqueKeyColumns.length > 0
            ? state.duplicateDetectionSettings.uniqueKeyColumns
            : undefined,
          duplicateAction: state.duplicateDetectionSettings.uniqueKeyColumns.length > 0 ||
            state.duplicateDetectionSettings.duplicateAction === 'replace-date-range'
            ? state.duplicateDetectionSettings.duplicateAction
            : undefined,
          addTimestamp: state.duplicateDetectionSettings.addTimestamp,
        });

        updateState({
          importProgress: {
            rowsImported: result.importOperation.rowsImported,
            rowsSkipped: result.importOperation.rowsSkipped,
            duplicatesSkipped: result.importOperation.duplicatesSkipped,
            duplicateDetails: result.importOperation.duplicateDetails,
            errorDetails: result.importOperation.errorDetails,
          },
        });
      } else {
        // Upload mode
        const result = await syncToExistingTable({
          tableName: targetTable!.tableName,
          filePath: state.selectedFile!,
          sheetIndex: state.selectedSheet,
          columnMappings: state.columnMappings!,
          mergeConfig: state.mergeConfig || undefined,
          headerRow: state.headerRow,
          skipBottomRows: state.skipBottomRows,
          appliedSplits: state.appliedSplits.length > 0 ? state.appliedSplits : undefined,
          uniqueKeyColumns: state.duplicateDetectionSettings.uniqueKeyColumns,
          duplicateAction: state.duplicateDetectionSettings.duplicateAction,
        });

        updateState({
          importProgress: {
            rowsImported: result.rowsImported,
            rowsSkipped: result.rowsSkipped,
            duplicatesSkipped: result.duplicatesSkipped,
            duplicateDetails: result.duplicateDetails,
            errorDetails: result.errorDetails,
          },
        });
      }

      updateState({ isImporting: false });
      setCurrentStep('complete');
      setError(null);
    } catch (err) {
      updateState({
        isImporting: false,
        importError: err instanceof Error ? err.message : `${mode === 'import' ? 'Import' : 'Upload'} failed`,
      });
      setCurrentStep('complete');
    }
  };

  const handleFinish = () => {
    onComplete();
    onClose();
  };

  // Render step indicator
  const renderStepIndicator = () => {
    const visibleSteps = STEP_CONFIGS.filter((step) => {
      // Skip file-selection if file was pre-selected
      if (step.id === 'file-selection' && preSelectedFile) {
        return false;
      }
      if (step.modesApplicable && !step.modesApplicable.includes(mode)) {
        return false;
      }
      if (step.isConditional) {
        const currentSheet = state.parsedData?.sheets[state.selectedSheet];
        if (step.id === 'island-selection') {
          return mode === 'import' && currentSheet?.detectedIslands && currentSheet.detectedIslands.length > 0;
        }
        if (step.id === 'column-split') {
          return currentSheet?.splitSuggestions && currentSheet.splitSuggestions.length > 0;
        }
      }
      return true;
    });

    const currentIndex = visibleSteps.findIndex((s) => s.id === currentStep);

    return (
      <div className="import-wizard-steps">
        {visibleSteps.map((step, index) => (
          <React.Fragment key={step.id}>
            <div
              className={`import-wizard-step ${
                index <= currentIndex ? (index === currentIndex ? 'active' : 'completed') : ''
              }`}
            >
              <div className="import-wizard-step-number">{index + 1}</div>
              <div className="import-wizard-step-label">{step.label}</div>
            </div>
            {index < visibleSteps.length - 1 && <div className="import-wizard-step-separator" />}
          </React.Fragment>
        ))}
      </div>
    );
  };

  // Render step content
  const renderStepContent = () => {
    const baseProps = {
      mode,
      targetTable,
      wizardState: state,
      onStateChange: updateState,
      onNext: handleNext,
      onBack: handleBack,
      error,
      setError,
    };

    switch (currentStep) {
      case 'file-selection':
        return <FileSelectionStep {...baseProps} onFileSelect={handleFileSelect} />;
      case 'parse-config':
        return <ParseConfigStep {...baseProps} />;
      case 'island-selection':
        return <IslandSelectionStep {...baseProps} />;
      case 'column-split':
        return <ColumnSplitStep {...baseProps} />;
      case 'table-info':
        return <TableInfoStep {...baseProps} />;
      case 'column-mapping':
        if (!state.parsedData) return null;
        const currentSheet = state.parsedData.sheets[state.selectedSheet];
        if (!currentSheet || !currentSheet.headers || !currentSheet.detectedTypes) {
          return <div className="error-message">Error: Sheet data not available. Please go back and re-parse the file.</div>;
        }

        // Format data for VisualColumnMapper
        const excelColumns = currentSheet.headers.map((header: string, idx: number) => ({
          name: header,
          type: currentSheet.detectedTypes[idx],
        }));
        const sampleRows = currentSheet.rows ? currentSheet.rows.slice(0, 3) : [];

        return (
          <VisualColumnMapper
            excelColumns={excelColumns}
            sampleRows={sampleRows}
            onMappingComplete={handleColumnMappingComplete}
            onBack={handleBack}
          />
        );
      case 'duplicate-detection':
        return <DuplicateDetectionStep {...baseProps} />;
      case 'preview':
        return <PreviewStep {...baseProps} />;
      case 'importing':
        return <ProgressStep {...baseProps} />;
      case 'complete':
        return <CompletionStep {...baseProps} />;
      default:
        return null;
    }
  };

  // Render footer buttons
  const renderFooter = () => {
    if (currentStep === 'file-selection') {
      return (
        <button className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
      );
    }

    if (currentStep === 'importing') {
      return null; // No buttons while importing
    }

    if (currentStep === 'complete') {
      return (
        <button className="btn btn-primary" onClick={handleFinish}>
          Finish
        </button>
      );
    }

    const isColumnMappingStep = currentStep === 'column-mapping';

    return (
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', width: '100%' }}>
        <button className="btn btn-secondary" onClick={handleBack}>
          ⬅️ Back
        </button>
        {!isColumnMappingStep && (
          <button className="btn btn-primary" onClick={handleNext}>
            Next ➡️
          </button>
        )}
      </div>
    );
  };

  const title = mode === 'import' ? 'Import Excel Data' : `Upload Data to ${targetTable?.displayName}`;

  return (
    <div className="import-wizard">
      <div className="import-wizard-dialog">
        <div className="import-wizard-header">
          <h2>{title}</h2>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        {renderStepIndicator()}

        <div className="import-wizard-body">
          {renderStepContent()}
        </div>

        <div className="import-wizard-footer">
          {renderFooter()}
        </div>
      </div>
    </div>
  );
};
