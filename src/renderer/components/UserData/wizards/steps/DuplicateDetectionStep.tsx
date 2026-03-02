import React from 'react';
import { BaseStepProps } from '../types';
import { DuplicateDetectionSettings } from '../../DuplicateDetectionSettings';

/**
 * DuplicateDetectionStep - Wrapper around existing DuplicateDetectionSettings
 * 100% duplicate code elimination from ImportWizard and ExcelUploadDialog
 */
export const DuplicateDetectionStep: React.FC<BaseStepProps> = ({
  mode,
  wizardState,
  onStateChange,
}) => {
  const { parsedData, selectedSheet, columnMappings, duplicateDetectionSettings } = wizardState;

  if (!parsedData) return null;

  const currentSheet = parsedData.sheets[selectedSheet];
  const schema = currentSheet.headers.map((header: string, idx: number) => ({
    name: Object.values(columnMappings || {})[idx] || header,
    type: currentSheet.detectedTypes[idx],
  }));

  return (
    <div>
      <h3 style={{ marginBottom: '20px' }}>Duplicate Detection</h3>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Configure how to handle duplicate rows{mode === 'import' ? ' in future imports' : ''}. This prevents the same data from being imported multiple times.
      </p>

      <DuplicateDetectionSettings
        schema={schema}
        initialUniqueColumns={duplicateDetectionSettings.uniqueKeyColumns}
        initialDuplicateAction={duplicateDetectionSettings.duplicateAction}
        initialAddTimestamp={duplicateDetectionSettings.addTimestamp}
        onSettingsChange={(settings) => onStateChange({ duplicateDetectionSettings: settings })}
      />
    </div>
  );
};
