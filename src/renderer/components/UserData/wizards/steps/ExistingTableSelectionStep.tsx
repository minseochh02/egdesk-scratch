import React from 'react';
import { BaseStepProps } from '../types';
import { ExistingTableMapper } from '../../ExistingTableMapper';
import { UserTable } from '../../../../hooks/useUserData';

interface ExistingTableSelectionStepProps extends BaseStepProps {
  availableTables: UserTable[];
  onMappingComplete: (tableId: string, mappings: Record<string, string>) => void;
}

/**
 * ExistingTableSelectionStep - Select existing table and map columns (browser-sync sync-existing mode)
 */
export const ExistingTableSelectionStep: React.FC<ExistingTableSelectionStepProps> = ({
  wizardState,
  availableTables,
  onMappingComplete,
  onBack,
}) => {
  const { parsedData, selectedSheet } = wizardState;

  if (!parsedData) return null;

  const currentSheet = parsedData.sheets[selectedSheet];

  return (
    <div>
      <ExistingTableMapper
        excelColumns={currentSheet.headers}
        excelTypes={currentSheet.detectedTypes}
        sampleRows={currentSheet.rows.slice(0, 3)}
        availableTables={availableTables}
        onMappingComplete={onMappingComplete}
        onBack={onBack}
      />
    </div>
  );
};
