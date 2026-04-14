import React from 'react';
import { ExcelDataWizard } from './wizards/ExcelDataWizard';

interface SyncWizardProps {
  selectedFilePath: string;
  onClose: () => void;
  onComplete: () => void;
}
export const SyncWizard: React.FC<SyncWizardProps> = ({ selectedFilePath, onClose, onComplete }) => {
  return (
    <ExcelDataWizard
      mode="import"
      preSelectedFile={selectedFilePath}
      onClose={onClose}
      onComplete={onComplete}
    />
  );
};
