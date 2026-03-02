import React from 'react';
import { ExcelDataWizard } from './wizards/ExcelDataWizard';

interface ImportWizardProps {
  onClose: () => void;
  onComplete: () => void;
}

/**
 * ImportWizard - Thin wrapper around ExcelDataWizard in import mode
 * Preserves existing API for zero breaking changes
 */
export const ImportWizard: React.FC<ImportWizardProps> = ({ onClose, onComplete }) => {
  return <ExcelDataWizard mode="import" onClose={onClose} onComplete={onComplete} />;
};
