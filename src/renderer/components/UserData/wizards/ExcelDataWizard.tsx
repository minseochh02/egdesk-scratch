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
  isBrowserSync,
  scriptFolderPath,
  scriptName,
  folderName,
}) => {
  const {
    parseExcel,
    importExcel,
    syncToExistingTable,
    selectExcelFile,
    validateTableName,
  } = useUserData();

  const { state, updateState } = useWizardState(mode, isBrowserSync);
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

  // Auto-enable addTimestamp checkbox if target table has imported_at column
  React.useEffect(() => {
    if (mode === 'upload' && targetTable?.hasImportedAtColumn) {
      updateState({
        duplicateDetectionSettings: {
          ...state.duplicateDetectionSettings,
          addTimestamp: true,
        },
      });
    }
  }, [mode, targetTable?.hasImportedAtColumn]);

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
        // Upload mode: check islands → splits → column-mapping
        if (currentSheet.detectedIslands && currentSheet.detectedIslands.length > 0) {
          setCurrentStep('island-selection');
        } else if (currentSheet.splitSuggestions && currentSheet.splitSuggestions.length > 0) {
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

          console.log(`\n🔍 [FRONTEND SPLIT] ===== SPLITTING COLUMN "${originalColumn}" =====`);
          console.log(`🔍 [FRONTEND SPLIT] Original headers:`, updatedSheet.headers);
          console.log(`   Splitting at index ${originalIndex} into: "${dateColName}", "${numberColName}"`);

          newHeaders.splice(originalIndex, 1, dateColName, numberColName);

          console.log(`🔍 [FRONTEND SPLIT] New headers:`, newHeaders);
          console.log(`   Column count: ${updatedSheet.headers.length} → ${newHeaders.length} (${newHeaders.length - updatedSheet.headers.length})`);

          const dateWithNumberPattern4Digit = /^(\d{4}[-/]\d{2}[-/]\d{2})\s*-?(\d+)$/;
          const dateWithNumberPattern2Digit = /^(\d{2}[-/]\d{2}[-/]\d{2})\s*-?(\d+)$/;

          const newRows = updatedSheet.rows.map((row: any, rowIdx: number) => {
            if (rowIdx === 0) {
              console.log(`\n🔍 [FRONTEND SPLIT] Before split - row keys:`, Object.keys(row));
              console.log(`🔍 [FRONTEND SPLIT] Before split - row data:`, row);
            }

            const newRow = { ...row };
            const originalValue = row[originalColumn];

            if (rowIdx === 0) {
              console.log(`🔍 [FRONTEND SPLIT] After spread - newRow keys:`, Object.keys(newRow));
            }

            delete newRow[originalColumn];

            if (rowIdx === 0) {
              console.log(`🔍 [FRONTEND SPLIT] After delete "${originalColumn}" - newRow keys:`, Object.keys(newRow));
            }

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

            if (rowIdx === 0) {
              console.log(`🔍 [FRONTEND SPLIT] After adding "${dateColName}" and "${numberColName}" - newRow keys:`, Object.keys(newRow));
              console.log(`🔍 [FRONTEND SPLIT] Final newRow data:`, newRow);
              console.log(`   Original had ${Object.keys(row).length} columns, new has ${Object.keys(newRow).length} columns`);
              console.log(`   Difference: ${Object.keys(newRow).length - Object.keys(row).length} (should be +1)\n`);
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

          console.log(`🔍 [FRONTEND SPLIT] ===== SPLIT COMPLETE =====`);
          console.log(`   Sheet now has ${updatedSheet.headers.length} headers:`, updatedSheet.headers);
          console.log(`   First row has ${Object.keys(updatedSheet.rows[0]).length} keys:`, Object.keys(updatedSheet.rows[0]));
          console.log(`   First row data:`, updatedSheet.rows[0]);
          console.log(`🔍 [FRONTEND SPLIT] ===========================\n`);
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
      if (currentSheet?.detectedIslands && currentSheet.detectedIslands.length > 0) {
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
        } else if (currentSheet?.detectedIslands && currentSheet.detectedIslands.length > 0) {
          setCurrentStep('island-selection');
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
      // Handle island selection completion - merge islands if merge mode is enabled
      const currentSheet = state.parsedData?.sheets[state.selectedSheet];
      let sheetToCheck = currentSheet; // Will be updated if merge happens

      if (state.islandImportMode === 'merged' && state.selectedIslands.size > 0) {
        console.log(`🔀 Merging ${state.selectedIslands.size} selected islands...`);

        // Get selected islands
        const islands = currentSheet?.detectedIslands || [];
        const selectedIslandObjects = Array.from(state.selectedIslands)
          .map(idx => islands[idx])
          .filter(island => island !== undefined);

        if (selectedIslandObjects.length === 0) {
          setError('No islands selected for merging');
          return;
        }

        // Validate: all islands must have identical headers
        const firstHeaders = selectedIslandObjects[0].headers;
        const headerMismatch = selectedIslandObjects.find(
          (island, idx) => {
            if (island.headers.length !== firstHeaders.length) {
              console.error(`Island ${idx} has ${island.headers.length} columns, expected ${firstHeaders.length}`);
              return true;
            }
            const mismatch = island.headers.some((h, i) => h !== firstHeaders[i]);
            if (mismatch) {
              console.error(`Island ${idx} has different header names:`, island.headers);
            }
            return mismatch;
          }
        );

        if (headerMismatch) {
          setError('Cannot merge islands with different column structures. All islands must have identical columns.');
          return;
        }

        // Merge islands
        let mergedHeaders = [...firstHeaders];
        const metadataColumnNames: string[] = [];

        if (state.addMetadataColumns) {
          // Check if any island has metadata
          const hasMetadata = selectedIslandObjects.some(island => island.metadata);

          if (hasMetadata) {
            metadataColumnNames.push('회사명', '기간', '계정코드_메타', '계정명_메타');
            mergedHeaders = [...mergedHeaders, ...metadataColumnNames];
            console.log(`   📋 Adding metadata columns: ${metadataColumnNames.join(', ')}`);
          }
        }

        // Merge all rows
        const mergedRows: any[] = [];
        selectedIslandObjects.forEach((island, islandIndex) => {
          island.rows.forEach(row => {
            const mergedRow = { ...row };

            // Add metadata columns if requested
            if (state.addMetadataColumns && metadataColumnNames.length > 0) {
              if (island.metadata) {
                mergedRow['회사명'] = island.metadata.company || null;
                mergedRow['기간'] = island.metadata.dateRange || null;
                mergedRow['계정코드_메타'] = island.metadata.accountCode || null;
                mergedRow['계정명_메타'] = island.metadata.accountName || null;
              } else {
                mergedRow['회사명'] = null;
                mergedRow['기간'] = null;
                mergedRow['계정코드_메타'] = null;
                mergedRow['계정명_메타'] = null;
              }
            }

            mergedRows.push(mergedRow);
          });

          console.log(`   ✅ Merged island ${islandIndex + 1}/${selectedIslandObjects.length}: "${island.title}" (${island.rows.length} rows)`);
        });

        // Detect column types for merged dataset
        const detectedTypes: any[] = [...selectedIslandObjects[0].detectedTypes];

        // Add types for metadata columns
        if (state.addMetadataColumns && metadataColumnNames.length > 0) {
          detectedTypes.push('TEXT', 'TEXT', 'TEXT', 'TEXT'); // 회사명, 기간, 계정코드, 계정명
        }

        console.log(`✅ Merged ${selectedIslandObjects.length} islands: ${mergedRows.length} total rows, ${mergedHeaders.length} columns`);
        console.log(`   Headers: ${mergedHeaders.join(', ')}`);

        // Preserve split suggestions from first island (all islands should have identical structure)
        const splitSuggestions = selectedIslandObjects[0].splitSuggestions;

        // Update parsed data with merged result
        const updatedSheet = {
          ...currentSheet!,
          headers: mergedHeaders,
          rows: mergedRows,
          detectedTypes: detectedTypes,
          splitSuggestions: splitSuggestions || undefined,
        };

        const newParsedData = { ...state.parsedData! };
        newParsedData.sheets[state.selectedSheet] = updatedSheet;

        updateState({ parsedData: newParsedData });

        // Use the updated sheet to determine next step
        sheetToCheck = updatedSheet;

        console.log(`🔀 Island merge complete. Sheet now has ${mergedHeaders.length} columns and ${mergedRows.length} rows.`);
      }

      // Proceed to next step using the potentially updated sheet
      if (sheetToCheck?.splitSuggestions && sheetToCheck.splitSuggestions.length > 0) {
        setCurrentStep('column-split');
      } else if (mode === 'import') {
        setCurrentStep('table-info');
      } else {
        setCurrentStep('column-mapping');
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
          tableId: targetTable!.id,
          filePath: state.selectedFile!,
          sheetIndex: state.selectedSheet,
          columnMappings: state.columnMappings!,
          mergeConfig: state.mergeConfig || undefined,
          headerRow: state.headerRow,
          skipBottomRows: state.skipBottomRows,
          appliedSplits: state.appliedSplits.length > 0 ? state.appliedSplits : undefined,
          uniqueKeyColumns: state.duplicateDetectionSettings.uniqueKeyColumns,
          duplicateAction: state.duplicateDetectionSettings.duplicateAction,
          addTimestamp: state.duplicateDetectionSettings.addTimestamp,
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

      // Create sync configuration for browser-sync mode
      console.log('🔍 [SYNC CONFIG DEBUG] Checking conditions:');
      console.log('   state.saveAsConfiguration:', state.saveAsConfiguration);
      console.log('   state.selectedFile:', state.selectedFile);
      console.log('   scriptFolderPath:', scriptFolderPath);
      console.log('   scriptName:', scriptName);
      console.log('   folderName:', folderName);
      console.log('   isBrowserSync prop:', isBrowserSync);

      if (state.saveAsConfiguration && state.selectedFile && scriptFolderPath && scriptName && folderName) {
        try {
          console.log('📝 Creating sync configuration for browser downloads...');
          console.log('   Script folder:', scriptFolderPath);
          console.log('   Script name:', scriptName);
          console.log('   Folder name:', folderName);

          // Get target table ID
          const targetTableId = mode === 'import'
            ? result.table.id
            : targetTable!.id;

          // Create sync configuration
          console.log('📋 [SYNC CONFIG] Creating sync configuration...');
          console.log('   Column mappings being saved:', state.columnMappings);
          console.log('   Applied splits:', state.appliedSplits);
          console.log('   Number of mappings:', Object.keys(state.columnMappings || {}).length);

          const configResult = await (window as any).electron.invoke('sync-config:create', {
            scriptFolderPath,
            scriptName,
            folderName,
            targetTableId,
            headerRow: state.headerRow,
            skipBottomRows: state.skipBottomRows,
            sheetIndex: state.selectedSheet,
            columnMappings: state.columnMappings!,
            appliedSplits: state.appliedSplits.length > 0 ? state.appliedSplits : undefined,
            uniqueKeyColumns: state.duplicateDetectionSettings.uniqueKeyColumns.length > 0
              ? state.duplicateDetectionSettings.uniqueKeyColumns
              : undefined,
            duplicateAction: state.duplicateDetectionSettings.uniqueKeyColumns.length > 0 ||
              state.duplicateDetectionSettings.duplicateAction === 'replace-date-range'
              ? state.duplicateDetectionSettings.duplicateAction
              : 'skip',
            fileAction: state.archiveAfterImport ? 'archive' : 'keep',
            autoSyncEnabled: state.enableAutoSync,
          });

          if (configResult.success) {
            console.log('✅ Sync configuration created successfully');
          } else {
            console.error('❌ Failed to create sync configuration:', configResult.error);
            // Don't fail the whole import, just log the error
          }
        } catch (err) {
          console.error('❌ Error creating sync configuration:', err);
          // Don't fail the whole import
        }
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
          // Show island selection for BOTH import and upload modes when islands detected
          return currentSheet?.detectedIslands && currentSheet.detectedIslands.length > 0;
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
            targetTable={mode === 'upload' && targetTable ? targetTable : undefined}
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
